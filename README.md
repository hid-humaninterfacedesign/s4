# HID S4
Minimal Step Sequencer and Multitrack Sample Player for use with the Elekrosil Smart-Switch. This Application is CLI only, there is no graphical user interface other than the Smart-Switch. This project is based on node.js and some libraries that all should run on common OS. Tested on Mac and Ubuntu Linux. Earlier versions were also tested on raspbian.

WARNING:
This appliction was built for demonstration purposes only and might damage your audio devices when misconfigured. Use it on your own risk.

# Elektrosil Smart-Switch
We use the Elektrosil Smart-Switch as controller. This rotary controller unit features an integrated rgb led ring and is connected via USB. However, the step sequencer and sampler are independent of this and can also be used in a different context or with different input devices. More information about the Smart-Switch on the Elektrosil website.  
https://www.elektrosil.com/en/home-2/product-portfolio/smart-switch/

# Setup
Node.js and the bundled NPM Package Manager are required. Follow instructions on the node.js homepage. This project is tested with node.js version 14.15.1.  
https://nodejs.org/en/download/

## Installation
Asuming node.js installed on your system run following command within the directory containing this README. This will install all dependencies defined in package.json. Watch out for errors, in case check node --version

```
npm install
```

## Install Node for Raspberry PI
Download Node 14 and Install on PI. Feel free to check for new versions.

```
wget https://nodejs.org/dist/v14.15.1/node-v14.15.1-linux-armv7l.tar.xz
tar -xzf node-v14.15.1-linux-armv7l.tar.xz

cd node-v14.15.1-linux-armv7l/

sudo cp -R * /usr/local/
```

# Run
After Installation use NPM to start the App.
```
npm start
```

# Quit
This Application does not listen for any input. Just kill the process.
```
ctrl + c
```

# USB Discovery
When not already connected, the Application is polling for the Smart-Switch plugged into your system. The poll interval is 3 Seconds per default. You may choose to connect and disconnect the Smart-Switch during runtime. No need to restart this application.

# Configuration
The program extpects a valid conf.json located in the directory containing this README.


## Default Configuration
This is the default configuration. 6 Tracks are defined, each with a unique color as hex string and a distinct volume.

```
{
    "latency": 250,
    "interpolation": 0.3,
    "tracks": [
        {
            "sample": "samples/kick-44100-16-mono.wav", 
            "color": "#0A007D",
            "volume": 0.7
        },
        {
            "sample": "samples/tom-44100-16-mono.wav", 
            "color": "#1D4A5D",
            "volume": 0.3,
            "interpolation": 0.1
        },
        {
            "sample": "samples/snare-44100-16-mono.wav", 
            "color": "#7A0D00",
            "volume": 0.2
        },
        {
            "sample": "samples/clap-44100-16-mono.wav", 
            "color": "#DB1DDA",
            "volume": 0.4
        },
        {
            "sample": "samples/hihat-closed-44100-16-mono.wav", 
            "color": "#00F7FF",
            "volume": 0.45,
            "interpolation": 0.6
        },
        {
            "sample": "samples/hihat-open-44100-16-mono.wav", 
            "color": "#F7FF00",
            "volume": 0.4
        }
    ]
}
```

## Properties
Some further explainations

### latency 
Audio Playback latency to prevent buffer undeflows. Time in msec.

### interpolation
Global Sampler sample value interpolation over time. To deactivate Interpolation set to 0 or false.
Safe Minimum 0.05
Safe Maximum 0.95

### tracks 
An Array containing Track Objects. Can contain an arbitary number of tracks. Using more than 16 will not suit the used LED Layout and probably lead to undefined behavior.
Minimum 1 Track
Maximum 16 Tracks

### track.sample
Path to the sample to use for this track. Location is relative to the directory that contains the conf.json. The path notation is UNIX style by default. Paths are normalized, prob. even Windows paths will work on all platforms (not tested).

IMPORTANT:
Only use 44.1kHz 16Bit Mono Wave Files without additional headers or metadata.

### track.color
Color used with the LED Ring when track is selected. Default Hex String Notation, aka. CSS Colors. If I remember correctly the hash sign is optional.

### track.volume
Volume Multiplicator used globally for this sample. Be sure to leave some Headroom, since the Samples of all tracks are summed and hard limited. If you want distortion you might try higher values.
Safe Minimum 0.1
Safe Maximum .9

Every note played has a velocity multiplicator that is also multiplied when reading a sample. The default value is .5 but can be adjusted per step.

### track.interpolation
Track sample value interpolation over time. To deactivate Interpolation set to 0 or false.
Safe Minimum 0.05
Safe Maximum 0.95

# Samples
All individually recorded, mixed and processed samples are property of the HID Human Interface GmbH. The use and distribution with this application is explicitly allowed. All samples are provided under the CC0 License and are dedicated to the Public Domain otherwise.

You might add your own samples or modify the existing. All Samples used with this application are expected to be 44.1kHz 16Bit Mono Wave files.

# LED Mapping
The LED Ring is used in a modal fashion. While the first 16 Segments are used to set values and the last 4 for selecting a mode.

1-16 Step Selection / Step Velocity / Track Selection / Master Volume  / Tempo
17-21 Not in use
22 Master Volume
23 Tempo
24 Track Selection
25 Play / Pause

# Modules
The functionality ist splitted into different modules.

## src/index.js
Entry Point. Setting up modules and pass all to Controller

## src/controller.js
Application specific. Primarily glue code. Manages User Interaction.

## src/smart-switch.js
PNP capable Smart-Switch Module. Provides some higher level interfaces to the Smart-Switch.

## src/sequencer.js
Simple Multitrack Step Sequencer with integrated clock.

## src/sampler.js
Loads and plays multiple 44.1kHz 16bit Mono Wav files. Provides a raw audio stream that can be piped to some audiosink.

# Dependencies
There are quite some external dependencies. The following are the root deps installed with this project.

## BitBuffer
Manipulate Buffers bitwise  
https://www.npmjs.com/package/bit-buffer

## hex-rgb
Convert hex strings to rgb  
https://www.npmjs.com/package/hex-rgb

## nanotimer
Precision Timer  
https://www.npmjs.com/package/nanotimer

## node-hid
USB Management  
https://www.npmjs.com/package/node-hid

## node-speaker
Audio Playback  
https://www.npmjs.com/package/node-hid

Internally using mpg123 Audio Backend.  
https://www.mpg123.de/

Check out a possible alternative built around portaudio instead of mpg123  
https://www.npmjs.com/package/naudiodon

# Known Issues
Depending on your System and the number of tracks used you might experience audio buffer underflows and timing issues.
There might be Playback Latency up to 2 Seconds, depending on the Audio Backend used on your system.
The Master Volume might glitch a bit since values are not interpolated seperately.
Stop might glitch, since stream is muted without interpolation.

# Troubleshooting
If you encounter massive playback latency or audio glitches. You can try to manually enforce another audio backend.
```
npm install speaker --mpg123-backend=openal
```

# License
The sourcecode of this application is licensed under the MIT License. See LICENSE for more information. The samples provided are licensed under the CC0 License, see samples/LICENSE for more information.

# Contact
HID Human Interface Design GmbH  
Stresemannstraße 375  
22761 Hamburg

info@human-interface.de

+49 40 468 99 73 0