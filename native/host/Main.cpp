// Takemitsu Host: a headless plugin host for offline rendering.
//
// Commands (all output is JSON lines on stdout: {"event": ..., "data": ...}):
//   info   <plugin> [--state <in.bin>] [--save-state <out.bin>] [--wait <ms>] [--param <index>=<value>]...
//          Load a plugin, optionally apply a state, and report parameters, programs, buses and state.
//   render <job.json>
//          Render one or more tracks (one plugin instance each) to WAV stems. See RenderJob below.
//   editor <plugin> <state.bin> [--state <in.bin>]
//          Open the plugin window so a person can set it up; the state is saved on close.

#include <juce_audio_utils/juce_audio_utils.h>

#include <atomic>
#include <csignal>
#include <iostream>
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
//   "loadWaitMs": 5000,        // wall-clock wait after applying state (sample loading)
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
        after ((int) number (job, "loadWaitMs", 3000), [this, job, rate, block] {
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
