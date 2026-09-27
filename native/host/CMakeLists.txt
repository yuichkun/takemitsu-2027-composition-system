cmake_minimum_required(VERSION 3.22)
project(TakemitsuHost VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "12.0" CACHE STRING "Minimum macOS")

# JUCE: use a local checkout when JUCE_SOURCE_DIR is given, otherwise fetch a pinned release.
set(JUCE_SOURCE_DIR "" CACHE PATH "Path to a local JUCE checkout")
if(JUCE_SOURCE_DIR)
  add_subdirectory(${JUCE_SOURCE_DIR} ${CMAKE_BINARY_DIR}/juce EXCLUDE_FROM_ALL)
else()
  include(FetchContent)
  FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.13 GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(JUCE)
endif()

# A GUI app (not a console app) because plugins need a running message loop and the
# `editor` command shows the plugin window. LSUIElement keeps it out of the Dock.
juce_add_gui_app(TakemitsuHost
  PRODUCT_NAME "Takemitsu Host"
  BUNDLE_ID "network.yogo.takemitsu.host"
  PLIST_TO_MERGE "<plist><dict><key>LSUIElement</key><true/></dict></plist>")

target_sources(TakemitsuHost PRIVATE Main.cpp)
target_compile_definitions(TakemitsuHost PRIVATE
  JUCE_PLUGINHOST_VST3=1
  JUCE_PLUGINHOST_AU=1
  JUCE_WEB_BROWSER=0
  JUCE_USE_CURL=0
  JUCE_APPLICATION_NAME_STRING="Takemitsu Host"
  JUCE_APPLICATION_VERSION_STRING="0.1.0")
target_link_libraries(TakemitsuHost PRIVATE
  juce::juce_audio_utils
  juce::juce_audio_processors
  juce::juce_recommended_config_flags
  juce::juce_recommended_warning_flags)
