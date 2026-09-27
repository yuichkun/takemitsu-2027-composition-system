// Takemitsu Host: a headless plugin host for offline rendering.
//
// Commands (all output is JSON lines on stdout: {"event": ..., "data": ...}):
//   info   <plugin> [--state <in.bin>] [--save-state <out.bin>] [--wait <ms>] [--param <index>=<value>]...
//          Load a plugin, optionally apply a state, and report parameters, programs, buses and state.
//   render <job.json>
//          Render one or more tracks (one plugin instance each) to WAV stems. See RenderJob below.
//   editor <plugin> <state.bin> [--state <in.bin>]
//          Open the plugin window so a person can set it up; the state is saved on close.
//   serve  [--rate 48000] [--block 512]
//          Stay running and render chunks on request (JSON lines on stdin). See Serve below.

#include <juce_audio_utils/juce_audio_utils.h>

#include <mach/mach.h>

#include <atomic>
#include <csignal>
#include <iostream>
#include <map>
#include <thread>

using namespace juce;

namespace
{
std::atomic<bool> cancelled { false };

void report (const String& event, const var& data = {})
{
    auto* obj = new DynamicObject();
    obj->setProperty ("event", event);
    obj->setProperty ("data", data);
    std::cout << JSON::toString (var (obj), true) << std::endl;
}

var object (std::initializer_list<std::pair<const char*, var>> fields)
{
    auto* obj = new DynamicObject();
    for (auto& [key, value] : fields)
        obj->setProperty (key, value);
    return var (obj);
}

[[noreturn]] void fail (const String& message) { throw std::runtime_error (message.toStdString()); }

/** This process's memory footprint in MB (what Activity Monitor shows), without asking `ps`. */
double footprintMB()
{
    task_vm_info_data_t info;
    mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
    if (task_info (mach_task_self(), TASK_VM_INFO, (task_info_t) &info, &count) != KERN_SUCCESS)
        return 0.0;
    return (double) info.phys_footprint / (1024.0 * 1024.0);
}

double number (const var& v, const char* key, double fallback)
{
    return v.hasProperty (key) ? (double) v[key] : fallback;
}

String text (const var& v, const char* key, const String& fallback = {})
{
    return v.hasProperty (key) ? v[key].toString() : fallback;
}

var readJson (const File& file)
{
    if (! file.existsAsFile())
        fail ("Missing file: " + file.getFullPathName());
    auto parsed = JSON::parse (file.loadFileAsString());
    if (parsed.isVoid())
        fail ("Invalid JSON: " + file.getFullPathName());
    return parsed;
}

//==============================================================================
// Plugin loading

class Plugins
{
public:
    Plugins()
    {
        addDefaultFormatsToManager (formats);
    }

    std::unique_ptr<AudioPluginInstance> load (const String& path, double rate, int block)
    {
        OwnedArray<PluginDescription> types;
        for (auto* format : formats.getFormats())
            if (format->fileMightContainThisPluginType (path))
                format->findAllTypesForFile (types, path);

        if (types.isEmpty())
            fail ("No plugin found at " + path);

        String error;
        auto instance = formats.createPluginInstance (*types[0], rate, block, error);
        if (instance == nullptr)
            fail ("Could not load " + path + ": " + error);
        return instance;
    }

private:
    AudioPluginFormatManager formats;
};

void applyState (AudioPluginInstance& plugin, const File& file)
{
    MemoryBlock bytes;
    if (! file.loadFileAsData (bytes))
        fail ("Could not read state " + file.getFullPathName());
    plugin.setStateInformation (bytes.getData(), (int) bytes.getSize());
}

void saveState (AudioPluginInstance& plugin, const File& file)
{
    MemoryBlock bytes;
    plugin.getStateInformation (bytes);
    file.getParentDirectory().createDirectory();
    if (! file.replaceWithData (bytes.getData(), bytes.getSize()))
        fail ("Could not write state " + file.getFullPathName());
}

AudioProcessorParameter* findParameter (AudioPluginInstance& plugin, const var& spec)
{
    auto& params = plugin.getParameters();
    if (spec.hasProperty ("index"))
    {
        auto index = (int) spec["index"];
        if (! isPositiveAndBelow (index, params.size()))
            fail ("Parameter index out of range: " + String (index));
        return params[index];
    }
    auto name = text (spec, "name");
    for (auto* p : params)
        if (p->getName (256) == name)
            return p;
    fail ("No parameter named " + name);
}

void setParameter (AudioProcessorParameter& p, float normalised)
{
    p.beginChangeGesture();
    p.setValueNotifyingHost (normalised);
    p.endChangeGesture();
}

void prepareStereo (AudioPluginInstance& plugin, double rate, int block)
{
    auto layout = plugin.getBusesLayout();
    if (! layout.outputBuses.isEmpty())
    {
        layout.outputBuses.set (0, AudioChannelSet::stereo());
        for (int i = 1; i < layout.outputBuses.size(); ++i)
            layout.outputBuses.set (i, AudioChannelSet::disabled());
        plugin.setBusesLayout (layout);
    }
    plugin.setRateAndBufferSizeDetails (rate, block);
    plugin.prepareToPlay (rate, block);
}

//==============================================================================
// A transport that always plays, so tempo-synced instruments behave.

class Transport final : public AudioPlayHead
{
public:
    double rate = 48000.0;
    double bpm = 120.0;
    int64 sample = 0;

    Optional<PositionInfo> getPosition() const override
    {
        PositionInfo info;
        info.setTimeInSamples (sample);
        info.setTimeInSeconds ((double) sample / rate);
        info.setBpm (bpm);
        info.setPpqPosition ((double) sample / rate * bpm / 60.0);
        info.setIsPlaying (true);
        info.setTimeSignature (TimeSignature { 4, 4 });
        return info;
    }
};

//==============================================================================
// info

var describeParameters (AudioPluginInstance& plugin)
{
    Array<var> list;
    for (auto* p : plugin.getParameters())
    {
        auto entry = object ({
            { "index", p->getParameterIndex() },
            { "name", p->getName (256) },
            { "label", p->getLabel() },
            { "value", p->getValue() },
            { "text", p->getCurrentValueAsText() },
            { "default", p->getDefaultValue() },
            { "steps", p->getNumSteps() },
            { "discrete", p->isDiscrete() },
            { "automatable", p->isAutomatable() },
        });
        if (auto* withId = dynamic_cast<HostedAudioProcessorParameter*> (p))
            entry.getDynamicObject()->setProperty ("id", withId->getParameterID());
        auto strings = p->getAllValueStrings();
        if (! strings.isEmpty() && strings.size() <= 512)
        {
            Array<var> values;
            for (auto& s : strings)
                values.add (s);
            entry.getDynamicObject()->setProperty ("valueStrings", values);
        }
        list.add (entry);
    }
    return list;
}

var describePrograms (AudioPluginInstance& plugin)
{
    Array<var> list;
    for (int i = 0; i < plugin.getNumPrograms(); ++i)
        list.add (plugin.getProgramName (i));
    return object ({ { "current", plugin.getCurrentProgram() }, { "names", list } });
}

var describeBuses (AudioPluginInstance& plugin)
{
    Array<var> list;
    for (int i = 0; i < plugin.getBusCount (false); ++i)
        if (auto* bus = plugin.getBus (false, i))
            list.add (object ({ { "name", bus->getName() }, { "channels", bus->getNumberOfChannels() }, { "enabled", bus->isEnabled() } }));
    return list;
}

//==============================================================================
// render
//
// Job JSON:
// {
//   "sampleRate": 48000, "blockSize": 512, "frames": 480000, "bpm": 120,
//   "loadWaitMs": 0,           // wall-clock wait after applying state (BBC SO needs none)
//   "maxSpeed": 0,             // 0 = as fast as possible, 1 = real time, 4 = 4x real time
//   "tracks": [{
//     "id": "vn1", "plugin": "/Library/Audio/Plug-Ins/VST3/…vst3", "state": "…bin",
//     "parameters": [{ "index": 3, "value": 0.5 } | { "name": "Reverb", "value": 0 }],
//     "events": [{ "frame": 0, "bytes": [144, 60, 100] }],
//     "output": "…/vn1.wav"
//   }]
// }

struct Track
{
    String id;
    std::unique_ptr<AudioPluginInstance> plugin;
    std::vector<std::pair<int64, MidiMessage>> events;
    size_t next = 0;
    File output, partial;
    std::unique_ptr<AudioFormatWriter> writer;
    float peak = 0.0f;
    double sumSquares = 0.0;
};

std::unique_ptr<AudioFormatWriter> openWav (const File& file, double rate)
{
    file.getParentDirectory().createDirectory();
    file.deleteFile();
    std::unique_ptr<OutputStream> stream (file.createOutputStream());
    if (stream == nullptr)
        fail ("Cannot open " + file.getFullPathName());
    WavAudioFormat wav;
    auto writer = wav.createWriterFor (stream,
                                       AudioFormatWriterOptions()
                                           .withSampleRate (rate)
                                           .withNumChannels (2)
                                           .withBitsPerSample (32)
                                           .withSampleFormat (AudioFormatWriterOptions::SampleFormat::floatingPoint));
    if (writer == nullptr)
        fail ("Cannot create WAV writer for " + file.getFullPathName());
    return writer;
}

//==============================================================================
// serve
//
// The host keeps plugin instances loaded between requests, one per plugin state. It knows
// nothing about scores: every request says in full what to play (docs/worklog on the render
// speed-up). Requests, one JSON object per line on stdin:
//
//   { "op": "render", "id": "r1", "plugin": "…vst3", "key": "<state id>", "state": "…bin",
//     "chunks": [{ "id": "c1", "frames": 96000, "tailMax": 480000, "output": "…chunk",
//                  "events": [[frame, status, data1, data2], …] }] }
//   { "op": "ping", "id": "p1" }
//
// "done" carries the process's memory footprint in MB ("mb"), so the caller need not ask `ps`.
// "chunk" carries the frames written (0 when silent) and "silentOnsets", the frames of note-ons
// that stayed silent for 250 ms (see renderChunk).
//
// For each chunk the instance plays the events from frame 0, runs to `frames`, then on until
// its output stays below −80 dBFS for 250 ms (at most `tailMax` more frames). So a chunk always
// ends silent and the next chunk on the same instance starts from quiet. Chunks are written as
// "TKCH" files: a 24-byte header (magic, version 1, sample rate, frames, channels, float scale)
// followed by interleaved 16-bit samples scaled by `scale` (the chunk's peak), so quiet chunks
// keep their resolution.
//
// Replies: {"event":"loaded"}, {"event":"chunk"} per chunk, then {"event":"done"} (or
// {"event":"error"}) with the request id. Closing stdin ends the process. Instances are never
// destroyed: BBC SO can spin while being torn down, so the caller recycles whole processes.

struct Chunk
{
    String id;
    int64 frames = 0;
    int64 tailMax = 0;
    File output;
    std::vector<std::pair<int64, MidiMessage>> events;
};

/** Writes a chunk file; returns the frames written (0 when the chunk is silent). */
int64 writeChunk (const File& file, double rate, const std::vector<float>& left, const std::vector<float>& right, int64 frames)
{
    float peak = 0.0f;
    for (int64 i = 0; i < frames; ++i)
        peak = jmax (peak, std::abs (left[(size_t) i]), std::abs (right[(size_t) i]));
    if (peak == 0.0f)
        frames = 0;

    MemoryOutputStream out;
    out.write ("TKCH", 4);
    out.writeInt (1);
    out.writeInt ((int) rate);
    out.writeInt ((int) frames);
    out.writeInt (2);
    out.writeFloat (peak);
    auto scale = peak > 0.0f ? 32767.0f / peak : 0.0f;
    for (int64 i = 0; i < frames; ++i)
    {
        out.writeShort ((short) roundToInt (left[(size_t) i] * scale));
        out.writeShort ((short) roundToInt (right[(size_t) i] * scale));
    }

    file.getParentDirectory().createDirectory();
    auto partial = File (file.getFullPathName() + ".partial");
    if (! partial.replaceWithData (out.getData(), out.getDataSize()) || ! partial.moveFileTo (file))
        fail ("Cannot write " + file.getFullPathName());
    return frames;
}

//==============================================================================

class EditorWindow final : public DocumentWindow
{
public:
    EditorWindow (AudioPluginInstance& p, File file)
        : DocumentWindow ("Takemitsu Host — " + p.getName(), Colours::darkgrey, closeButton), plugin (p), stateFile (std::move (file))
    {
        editor.reset (plugin.createEditorAndMakeActive());
        if (editor == nullptr)
            fail ("Plugin has no editor");
        setContentNonOwned (editor.get(), true);
        setUsingNativeTitleBar (true);
        setVisible (true);
        centreWithSize (getWidth(), getHeight());
        devices.initialise (0, 2, nullptr, true);
        player.setProcessor (&plugin);
        devices.addAudioCallback (&player);
        devices.addMidiInputDeviceCallback ({}, &player);
        for (auto& input : MidiInput::getAvailableDevices())
            devices.setMidiInputDeviceEnabled (input.identifier, true);
    }

    ~EditorWindow() override
    {
        devices.removeMidiInputDeviceCallback ({}, &player);
        devices.removeAudioCallback (&player);
        player.setProcessor (nullptr);
        clearContentComponent();
        editor.reset();
    }

    void closeButtonPressed() override
    {
        saveState (plugin, stateFile);
        report ("state-saved", stateFile.getFullPathName());
        JUCEApplication::getInstance()->systemRequestedQuit();
    }

private:
    AudioPluginInstance& plugin;
    File stateFile;
    std::unique_ptr<AudioProcessorEditor> editor;
    AudioDeviceManager devices;
    AudioProcessorPlayer player;
};

//==============================================================================

class HostApp final : public JUCEApplication
{
public:
    const String getApplicationName() override { return "Takemitsu Host"; }
    const String getApplicationVersion() override { return "0.1.0"; }
    bool moreThanOneInstanceAllowed() override { return true; }

    void initialise (const String&) override
    {
        // First signal cancels a render cleanly; a second one exits immediately.
        static auto onSignal = [] (int) {
            if (cancelled.exchange (true))
                std::_Exit (130);
        };
        std::signal (SIGTERM, onSignal);
        std::signal (SIGINT, onSignal);

        args = getCommandLineParameterArray();
        try
        {
            if (args.isEmpty())
                fail ("usage: info <plugin> … | render <job.json> | editor <plugin> <state.bin>");

            auto command = args[0];
            if (command == "info")
                info();
            else if (command == "render")
                render();
            else if (command == "editor")
                openEditor();
            else if (command == "serve")
                serve();
            else
                fail ("Unknown command " + command);
        }
        catch (const std::exception& e)
        {
            finish (e.what());
        }
    }

    void shutdown() override
    {
        cancelled = true;
        if (worker.joinable())
            worker.join();
        window.reset();
        tracks.clear();
        single.reset();
    }

    void systemRequestedQuit() override
    {
        cancelled = true;
        quit();
    }

private:
    StringArray args;
    Plugins plugins;
    std::unique_ptr<AudioPluginInstance> single;
    std::vector<std::unique_ptr<Track>> tracks;
    std::unique_ptr<EditorWindow> window;
    std::thread worker;
    Transport transport;

    String option (const String& name, const String& fallback = {}) const
    {
        auto i = args.indexOf (name);
        return i >= 0 && i + 1 < args.size() ? args[i + 1] : fallback;
    }

    void finish (const String& error = {})
    {
        if (error.isNotEmpty())
        {
            report ("error", error);
            setApplicationReturnValue (1);
        }
        MessageManager::callAsync ([] { JUCEApplication::getInstance()->quit(); });
    }

    // Runs `work` after `ms` of wall-clock time on the message thread, so plugins can
    // finish their asynchronous loading while the message loop keeps running.
    void after (int ms, std::function<void()> work)
    {
        Timer::callAfterDelay (ms, [this, work] {
            try
            {
                work();
            }
            catch (const std::exception& e)
            {
                finish (e.what());
            }
        });
    }

    void info()
    {
        if (args.size() < 2)
            fail ("info <plugin>");
        single = plugins.load (args[1], 48000.0, 512);
        if (auto state = option ("--state"); state.isNotEmpty())
            applyState (*single, File (state));

        for (int i = 0; i < args.size(); ++i)
            if (args[i] == "--param" && i + 1 < args.size())
            {
                auto spec = args[i + 1];
                auto index = spec.upToFirstOccurrenceOf ("=", false, false).getIntValue();
                auto value = spec.fromFirstOccurrenceOf ("=", false, false).getFloatValue();
                setParameter (*findParameter (*single, object ({ { "index", index } })), value);
            }

        prepareStereo (*single, 48000.0, 512);
        after (option ("--wait", "0").getIntValue(), [this] {
            MemoryBlock state;
            single->getStateInformation (state);
            if (auto out = option ("--save-state"); out.isNotEmpty())
                saveState (*single, File (out));

            report ("info", object ({
                                { "name", single->getName() },
                                { "latency", single->getLatencySamples() },
                                { "tail", single->getTailLengthSeconds() },
                                { "acceptsMidi", single->acceptsMidi() },
                                { "buses", describeBuses (*single) },
                                { "programs", describePrograms (*single) },
                                { "stateBytes", (int) state.getSize() },
                                { "parameters", describeParameters (*single) },
                            }));
            finish();
        });
    }

    void openEditor()
    {
        if (args.size() < 3)
            fail ("editor <plugin> <state.bin>");
        single = plugins.load (args[1], 48000.0, 512);
        if (auto state = option ("--state"); state.isNotEmpty())
            applyState (*single, File (state));
        // Become a regular app while a person (or an automation tool) works in the window.
        Process::setDockIconVisible (true);
        window = std::make_unique<EditorWindow> (*single, File (args[2]));
        report ("editor-open", single->getName());
    }

    //==========================================================================
    // serve

    struct Instance
    {
        std::unique_ptr<AudioPluginInstance> plugin;
        Transport transport;
    };
    std::map<String, std::unique_ptr<Instance>> instances;

    void serve()
    {
        auto rate = option ("--rate", "48000").getDoubleValue();
        auto block = option ("--block", "512").getIntValue();
        worker = std::thread ([this, rate, block] {
            std::string line;
            while (! cancelled && std::getline (std::cin, line))
            {
                if (line.empty())
                    continue;
                auto request = JSON::parse (String (line));
                auto id = text (request, "id");
                try
                {
                    auto op = text (request, "op");
                    if (op == "ping")
                        report ("pong", object ({ { "id", id } }));
                    else if (op == "render")
                        serveRender (request, rate, block);
                    else
                        fail ("Unknown op " + op);
                }
                catch (const std::exception& e)
                {
                    report ("error", object ({ { "id", id }, { "message", String (e.what()) } }));
                }
            }
            // stdin closed: leave without tearing plugins down (see process()).
            std::cout.flush();
            std::_Exit (0);
        });
    }

    /** Loads (once) the instance for a state, on the message thread as plugins expect. */
    Instance& instanceFor (const var& request, double rate, int block)
    {
        auto key = text (request, "key");
        if (auto found = instances.find (key); found != instances.end())
            return *found->second;

        auto started = Time::getMillisecondCounterHiRes();
        std::unique_ptr<Instance> created;
        String error;
        WaitableEvent loaded;
        MessageManager::callAsync ([&] {
            try
            {
                auto instance = std::make_unique<Instance>();
                instance->plugin = plugins.load (text (request, "plugin"), rate, block);
                if (auto state = text (request, "state"); state.isNotEmpty())
                    applyState (*instance->plugin, File (state));
                instance->plugin->setNonRealtime (true);
                instance->transport.rate = rate;
                instance->plugin->setPlayHead (&instance->transport);
                prepareStereo (*instance->plugin, rate, block);
                created = std::move (instance);
            }
            catch (const std::exception& e)
            {
                error = e.what();
            }
            loaded.signal();
        });
        loaded.wait();
        if (created == nullptr)
            fail (error.isNotEmpty() ? error : "Could not load " + key);
        report ("loaded", object ({ { "key", key }, { "seconds", (Time::getMillisecondCounterHiRes() - started) / 1000.0 } }));
        return *(instances[key] = std::move (created));
    }

    void serveRender (const var& request, double rate, int block)
    {
        auto& instance = instanceFor (request, rate, block);
        auto* list = request["chunks"].getArray();
        if (list == nullptr)
            fail ("Request has no chunks");

        for (auto& spec : *list)
        {
            if (cancelled)
                return;
            Chunk chunk;
            chunk.id = text (spec, "id");
            chunk.frames = (int64) number (spec, "frames", 0);
            chunk.tailMax = (int64) number (spec, "tailMax", rate * 10);
            chunk.output = File (text (spec, "output"));
            if (auto* events = spec["events"].getArray())
                for (auto& e : *events)
                    if (auto* a = e.getArray(); a != nullptr && a->size() >= 2)
                    {
                        std::vector<uint8> bytes;
                        for (int i = 1; i < a->size(); ++i)
                            bytes.push_back ((uint8) (int) (*a)[i]);
                        chunk.events.emplace_back ((int64) (*a)[0], MidiMessage (bytes.data(), (int) bytes.size()));
                    }
            std::stable_sort (chunk.events.begin(), chunk.events.end(), [] (auto& a, auto& b) { return a.first < b.first; });

            auto started = Time::getMillisecondCounterHiRes();
            Array<var> silentOnsets;
            auto frames = renderChunk (instance, chunk, rate, block, silentOnsets);
            report ("chunk", object ({ { "id", chunk.id },
                                       { "frames", (int) frames },
                                       { "silentOnsets", silentOnsets },
                                       { "seconds", (Time::getMillisecondCounterHiRes() - started) / 1000.0 } }));
        }
        report ("done", object ({ { "id", text (request, "id") }, { "mb", footprintMB() } }));
    }

    /**
     * Renders a chunk and writes it; returns the frames written (0 when silent). `silentOnsets`
     * gets the frame of every note-on (key 12 and up; lower keys are keyswitches) whose first
     * 250 ms stayed below −90 dBFS: BBC SO plays silence while its samples are still loading
     * (docs/decisions/0019), and the caller decides which of those notes should have sounded.
     */
    int64 renderChunk (Instance& instance, const Chunk& chunk, double rate, int block, Array<var>& silentOnsets)
    {
        auto& plugin = *instance.plugin;
        const float quiet = 1.0e-4f; // −80 dBFS
        const auto quietNeeded = (int64) (rate * 0.25);
        const auto limit = chunk.frames + chunk.tailMax;

        std::vector<float> left, right;
        left.reserve ((size_t) (chunk.frames + rate * 3));
        right.reserve ((size_t) (chunk.frames + rate * 3));

        AudioBuffer<float> buffer (jmax (2, plugin.getTotalNumOutputChannels()), block);
        MidiBuffer midi;
        size_t next = 0;
        int64 quietFrames = 0;
        int64 pos = 0;
        for (; pos < limit && ! cancelled; pos += block)
        {
            instance.transport.sample = pos;
            buffer.clear();
            midi.clear();
            while (next < chunk.events.size() && chunk.events[next].first < pos + block)
            {
                auto& [frame, message] = chunk.events[next++];
                midi.addEvent (message, (int) jmax ((int64) 0, frame - pos));
            }
            plugin.processBlock (buffer, midi);

            float blockPeak = 0.0f;
            for (int i = 0; i < block; ++i)
            {
                auto l = buffer.getSample (0, i);
                auto r = buffer.getSample (1, i);
                if (! std::isfinite (l) || ! std::isfinite (r))
                    fail ("Non-finite sample in chunk " + chunk.id);
                left.push_back (l);
                right.push_back (r);
                blockPeak = jmax (blockPeak, std::abs (l), std::abs (r));
            }
            quietFrames = blockPeak < quiet ? quietFrames + block : 0;
            if (pos + block >= chunk.frames && next >= chunk.events.size() && quietFrames >= quietNeeded)
            {
                pos += block;
                break;
            }
        }
        if (cancelled)
            fail ("cancelled");

        // Drop the quiet end, keeping a few milliseconds, and fade the last of it out.
        auto length = jmax ((int64) 0, pos - jmax ((int64) 0, quietFrames - (int64) (rate * 0.02)));
        length = jmax (length, jmin (chunk.frames, pos));
        auto fade = jmin (length, (int64) (rate * 0.01));
        for (int64 i = 0; i < fade; ++i)
        {
            auto g = (float) i / (float) fade;
            left[(size_t) (length - 1 - i)] *= g;
            right[(size_t) (length - 1 - i)] *= g;
        }
        const auto window = (int64) (rate * 0.25);
        const float silent = 3.1623e-5f; // −90 dBFS
        for (auto& [frame, message] : chunk.events)
        {
            if (! message.isNoteOn() || message.getNoteNumber() < 12 || frame >= length)
                continue;
            float peak = 0.0f;
            for (auto i = frame; i < jmin (length, frame + window); ++i)
                peak = jmax (peak, std::abs (left[(size_t) i]), std::abs (right[(size_t) i]));
            if (peak < silent)
                silentOnsets.add ((int) frame);
        }
        return writeChunk (chunk.output, rate, left, right, length);
    }

    void render()
    {
        if (args.size() < 2)
            fail ("render <job.json>");
        auto job = readJson (File (args[1]));
        auto rate = number (job, "sampleRate", 48000.0);
        auto block = (int) number (job, "blockSize", 512);
        auto* list = job["tracks"].getArray();
        if (list == nullptr || list->isEmpty())
            fail ("Job has no tracks");

        for (auto& spec : *list)
        {
            auto track = std::make_unique<Track>();
            track->id = text (spec, "id");
            track->plugin = plugins.load (text (spec, "plugin"), rate, block);
            if (auto state = text (spec, "state"); state.isNotEmpty())
                applyState (*track->plugin, File (state));
            if (auto* params = spec["parameters"].getArray())
                for (auto& p : *params)
                    setParameter (*findParameter (*track->plugin, p), (float) (double) p["value"]);

            if (auto* events = spec["events"].getArray())
                for (auto& e : *events)
                {
                    std::vector<uint8> bytes;
                    if (auto* data = e["bytes"].getArray())
                        for (auto& b : *data)
                            bytes.push_back ((uint8) (int) b);
                    if (! bytes.empty())
                        track->events.emplace_back ((int64) e["frame"], MidiMessage (bytes.data(), (int) bytes.size()));
                }
            std::stable_sort (track->events.begin(), track->events.end(), [] (auto& a, auto& b) { return a.first < b.first; });

            track->output = File (text (spec, "output"));
            track->partial = File (track->output.getFullPathName() + ".partial");
            track->plugin->setNonRealtime (! job.hasProperty ("realtime") || ! (bool) job["realtime"]);
            track->plugin->setPlayHead (&transport);
            prepareStereo (*track->plugin, rate, block);
            report ("loaded", object ({ { "id", track->id }, { "plugin", track->plugin->getName() } }));
            tracks.push_back (std::move (track));
        }

        transport.rate = rate;
        transport.bpm = number (job, "bpm", 120.0);
        after ((int) number (job, "loadWaitMs", 0), [this, job, rate, block] {
            worker = std::thread ([this, job, rate, block] {
                try
                {
                    process (job, rate, block);
                    finish();
                }
                catch (const std::exception& e)
                {
                    finish (e.what());
                }
            });
        });
    }

    void process (const var& job, double rate, int block)
    {
        auto total = (int64) number (job, "frames", rate * 5);
        auto maxSpeed = number (job, "maxSpeed", 0.0);
        if (total <= 0 || block < 16 || block > 8192)
            fail ("Invalid render dimensions");

        for (auto& t : tracks)
            t->writer = openWav (t->partial, rate);

        AudioBuffer<float> buffer;
        MidiBuffer midi;
        auto started = Time::getMillisecondCounterHiRes();
        int lastPercent = -1;

        for (int64 pos = 0; pos < total && ! cancelled; pos += block)
        {
            auto count = (int) jmin ((int64) block, total - pos);
            transport.sample = pos;

            for (auto& t : tracks)
            {
                buffer.setSize (jmax (2, t->plugin->getTotalNumOutputChannels()), block, false, false, true);
                buffer.clear();
                midi.clear();
                while (t->next < t->events.size() && t->events[t->next].first < pos + count)
                {
                    auto& [frame, message] = t->events[t->next++];
                    midi.addEvent (message, (int) jmax ((int64) 0, frame - pos));
                }
                // Always process a full block: some instruments misbehave on a short final block.
                t->plugin->processBlock (buffer, midi);
                if (! t->writer->writeFromAudioSampleBuffer (buffer, 0, count))
                    fail ("WAV write failed for " + t->id);
                for (int c = 0; c < 2; ++c)
                    for (int i = 0; i < count; ++i)
                    {
                        auto s = buffer.getSample (c, i);
                        if (! std::isfinite (s))
                            fail ("Non-finite sample from " + t->id);
                        t->peak = jmax (t->peak, std::abs (s));
                        t->sumSquares += (double) s * s;
                    }
            }

            if (maxSpeed > 0.0)
            {
                auto due = started + (double) (pos + count) / rate * 1000.0 / maxSpeed;
                auto now = Time::getMillisecondCounterHiRes();
                if (due > now)
                    Thread::sleep ((int) (due - now));
            }

            auto percent = (int) (100 * (pos + count) / total);
            if (percent != lastPercent && percent % 5 == 0)
            {
                report ("progress", percent);
                lastPercent = percent;
            }
        }

        Array<var> results;
        for (auto& t : tracks)
        {
            t->plugin->releaseResources();
            t->writer.reset();
            if (cancelled)
            {
                t->partial.deleteFile();
                continue;
            }
            t->output.deleteFile();
            if (! t->partial.moveFileTo (t->output))
                fail ("Cannot publish " + t->output.getFullPathName());
            results.add (object ({
                { "id", t->id },
                { "file", t->output.getFullPathName() },
                { "peak", t->peak },
                { "rms", std::sqrt (t->sumSquares / (double) (total * 2)) },
            }));
        }
        if (cancelled)
            fail ("cancelled");
        report ("complete", object ({ { "tracks", results }, { "seconds", (Time::getMillisecondCounterHiRes() - started) / 1000.0 } }));

        // Everything is written. Some instruments spin forever while being destroyed
        // (BBC SO's percussion did), so leave without tearing the plugins down.
        std::cout.flush();
        std::_Exit (0);
    }
};
} // namespace

START_JUCE_APPLICATION (HostApp)
