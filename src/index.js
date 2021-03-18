// external dependencies
import Speaker from 'speaker' // Cross Platform low level audioSink
import hexRgb from 'hex-rgb' // convert hex strings to rgb values

// possible alternative to speaker, needs to be installed via npm
// import portAudio from 'naudiodon' 

// std lib dependencies
import * as fs from 'fs'

// internal dependencies
import SmartSwitch from './smart-switch.js' // 
import Sequencer from './sequencer.js'
import Sampler from './sampler.js'
import Controller from './controller.js'

// DO NOT CHANGE THESE CONSTANTS! WILL BREAK AUDIO PLAYBACK...
const SAMPLE_RATE = 44100 // hz
const BIT_DEPTH = 16
const SAMPLE_SIZE = BIT_DEPTH / 8 // 16 Bit -> 2 Byte Size
const CHANNELS = 1

/**
 * Initialization Procedure
 * @param {Object} conf 
 * Only use 44.1 kHz 16 Bit Mono PCM Wave Samples without any extra metadata
 * {
 *     "tracks": [
 *         {
 *             "sample": "samples/kick-44100-16-mono.wav", 
 *             "color": "#0A007D",
 *             "volume": 0.9
 *         },
 *      ...
 *     ]
 * }
 */
function init(conf) {
    const smartSwitch = new SmartSwitch()

    smartSwitch.onConnect = ()=>{
        // vibrate on smart switch connect
        smartSwitch.setMotor(
            [
                {steps:[1,0,1,0, 1,1,1,0, 0,0,0,0, 0,0,0,0], repeat:1},
                {steps:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], repeat:0},
                {steps:[1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0], repeat:0},
                {steps:[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], repeat:0}
            ],
            1,
            180
        )
    }

    // initialize Sampler. Samples defined in tracks Array will be loaded async.
    const sampler = new Sampler(conf.tracks, conf.latency, conf.interpolation)
    
    // create new audiosink (use systems default audio output)
    let audioSink = new Speaker({
        channels: CHANNELS,
        bitDepth: BIT_DEPTH,
        sampleRate: SAMPLE_RATE,
    })
    sampler.pipe(audioSink)

    // initialize sequencer
    const sequencer = new Sequencer(sampler.samples.length, 16)

    // pass all to controller, to manage user interaction
    const controller = new Controller(
        smartSwitch, 
        sequencer, 
        sampler,
        conf.tracks.map(track=> {
            // parsing hex colors and mapping to array
            const rgb = hexRgb(track.color)
            return {
                r: rgb.red,
                g: rgb.green,
                b: rgb.blue
            }
        })
    )

    // unmute some kick steps as starting point
    sequencer.unmute(0, 0)
    sequencer.unmute(0, 4)
    sequencer.unmute(0, 8)
    sequencer.unmute(0, 12)


    // Glue Sampler and Sequencer

    sequencer.onBeforePlay = () => {
        sampler.muted = false
        sampler.sync() 
    }

    sequencer.onPause = () => {
        sampler.muted = true
        sampler.clearQueue()
    }
    
    sequencer.onTrigger = (track, volume) => {
        // trigger sampler
        sampler.trigger(track, volume)
    }

}

// load and parse conf.json and call init function
fs.readFile("conf.json", function(err, data) { 
    if (err) return console.error(err)
    try {
        const conf = JSON.parse(data); 
        init(conf)  
    } catch(err) {
        console.error(err)
    }
  
}); 

