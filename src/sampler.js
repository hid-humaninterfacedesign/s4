// stdlib dependencies
import * as Stream from 'stream'
import * as fs from 'fs'
import * as pathUtil from 'path'
import { timingSafeEqual } from 'crypto'

// Max Trigger Queue length per sample (4 bars)
const MAX_TRIGGER_QUEUE_LENGTH = 64
const DEFAULT_LATENCY = 300 // msec, increase on frame drops or out of sync beats

// DO NOT CHANGE THESE CONSTANTS! WILL BREAK AUDIO PLAYBACK...
const MAX_AMPLITUDE = 32760
const SAMPLE_RATE = 44100
const BIT_DEPTH = 16
const SAMPLE_SIZE = BIT_DEPTH / 8 // 16 Bit equal 2 Byte Frame
const CHANNELS = 1
const BLOCK_SIZE = SAMPLE_SIZE * CHANNELS

/**
 * Multisample Player implemented as Readable Stream to connect directly to some audio sink
 * The sampler just outputs raw PCM data that has to be piped to a Writeable Steam
 */
export default class Sampler extends Stream.Readable {
    constructor(tracks, latency, interpolation) {
        super()

        this.samples = []
        this._value = 0
        this.interpolate = !!interpolation
        this.interpolationRatio = (interpolation) ? interpolation : .5
        this.syncRequested = true
        this._sync = -1
        this.muted = false


        this.time = 0

        this.latency = (latency) ? latency : DEFAULT_LATENCY
        this.triggerQueue = []

        // iterate through tracks and initalize Samples
        tracks.forEach((track) => {
            this.samples.push(new Sample(track.sample, track.volume, track.interpolation))
        })

        this.volume = 1.0
    }

    /**
     * Trigger sample playback
     * @param {int} sample index of sample that should be played
     * @param {float} velocity volume for that note
     */
    trigger(sample, velocity) {
        if (sample >= this.samples.length) return
        if (this._sync > 0 && this.triggerQueue.length < MAX_TRIGGER_QUEUE_LENGTH){
            this.triggerQueue.push({
                sample,
                velocity,
                time: ((Date.now() - this._sync) + this.latency) * (SAMPLE_RATE / 1000)
            })
        }
    }

    /**
     * Sync all samples
     * @param {int} time 
     */
    sync(time) {
        this.clearQueue()
        this._sync = Date.now()
        this.time = 0
    }
    
    /**
     * Empty Trigger Queue
     */
    clearQueue() {
        this.triggerQueue = []
    }

    /**
     * Main audio loop
     * THIS IS PERFORMANCE CRITICAL!
     * Overrides _read method of Stream.Readable
     * Try not to cause buffer underflow
     * @param {int} n Number of bytes to be read
     */
    _read(n) {

        const numSamples = n / BLOCK_SIZE | 0
        const buf = Buffer.alloc(n)
        
        for (let i = 0; i < numSamples; i++) {
             // check for trigger in queue
            while (this.triggerQueue.length > 0 && this.time >= this.triggerQueue[0].time) {
                // trigger time has come...
                const queueItem = this.triggerQueue.shift()
                const sample = this.samples[queueItem.sample]
                sample.index = 0
                sample.velocity = queueItem.velocity
            }
            let val = 0
            if (!this.muted) {
                for (let s = 0; s < this.samples.length; s++) {
                    val += this.samples[s].readSample()
                }
                val *= this.volume
                val = Math.min(MAX_AMPLITUDE, Math.max(-MAX_AMPLITUDE, val))
            }
            if (this.interpolate) {
                this._value = (this._value * (1-this.interpolationRatio) + val * (this.interpolationRatio))
            } else {
                this._value = val
            }
          
            for (let channel = 0; channel < CHANNELS; channel++) {
                const offset = (i * SAMPLE_SIZE * CHANNELS) + (channel * SAMPLE_SIZE)
                buf.writeInt16LE(this._value, offset)
            }

            this.time++
        }
        this.push(buf)
    }
}

/**
 * Sample Class
 * Stores PCM Raw data and provides read method that iterates internal index
 * using trigger queue that is shifted if event matches synced time (read is ahead of time)
 */
class Sample {
    constructor(file, volume, interpolation) {
        this.volume = volume 
        this.velocity = 1

        this.index = 0

        this.interpolate = !!interpolation
        this.interpolationRatio = (interpolation) ? interpolation : .5

        // internals
        this._value = 0


        this._load(file)
    }

    /**
     * Change general sample volume multiplier
     * @param {number} val 
     */
    setVolume(val) {
        this.volume = val
    }

    /**
     * read sample at index and advance cursor
     * THIS IS PERFORMANCE CRITICAL SINCE CALLED 44.1k PER SECOND
     */
    readSample() {
        let val = 0
        
        if (this.int16Array && this.index < this.int16Array.length) {
            // read and process sample, advance index
            val = this.int16Array[this.index] * this.volume * this.velocity
            this.index++
        }
        // interpolate (anti glitch while jumping in index)
        if (this.interpolate) {
            this._value =  (this._value * (1-this.interpolationRatio) + val * (this.interpolationRatio))
        } else {
            this._value = val
        }
        return this._value
    }

    /**
     * Async Sample loader.
     * Only works with 16Bit PCM Wave files
     */
    _load(file) {
        fs.readFile(pathUtil.normalize(file), (err, data) => {
            if (err) throw err
            // strip header and convert to Int 16 Array
            this.int16Array = new Int16Array(data.buffer.slice(44))
            console.log("loaded", file, this.int16Array.length);
            this.index = this.int16Array.length-1
        });
    }
    
}