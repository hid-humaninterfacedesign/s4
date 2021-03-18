// external dependencies
import NanoTimer from 'nanotimer' // precision timer

const DEFAULT_VOLUME = .5
const DEFAULT_BPM = 120

/**
 * Array Util
 * wraps index when length exceded (len-2, len-1, 0, 1, 2...)
 * @param {int} index 
 * @param {int} len 
 */
function wrap(index, len) {
    let m = index % len
    if (m < 0) m += len
    return m
}

/**
 * Step to hold state of one beat within a Track
 * Private Class
 */
class Step {
    constructor(volume, muted) {
        this.volume = volume || 0.
        this.muted = muted || false
    }

    mute() {
        this.muted = true

    }

    unmute() {
        this.muted = false
    }

    toggleMute() {
        this.muted = !this.muted
    }

    setVolume(value) {
        this.volume = value
    }

    getVolume() {
        //if (this.muted) return 0
        return this.volume
    }

    getMuted() {
        return this.muted
    }
}

/**
 * A Track contains multiple Steps
 * Private Class
 */
class Track {
    constructor(steps = 16) {
        // initialize steps
        this.steps = []
        for (let i=0; i<steps; i++) {
            this.steps[i] = new Step(DEFAULT_VOLUME, true)
        }
        Object.seal(this.steps)
    }
    mute(step) {
        this.steps[wrap(step, this.steps.length)].mute()
    }
    unmute(step) {
        this.steps[wrap(step, this.steps.length)].unmute()
    }
    toggleMute(step) {
        this.steps[wrap(step, this.steps.length)].toggleMute()
    }
    setVolume(step, value) {
        this.steps[wrap(step, this.steps.length)].setVolume(value)
    }
    getVolume(step) {
        return this.steps[wrap(step, this.steps.length)].getVolume()
    }
    getMuted(step) {
        return this.steps[wrap(step, this.steps.length)].getMuted()
    }
}

/**
 * Minimal Multitrack StepSequencer with internal clock
 * Does not play any sounds, just manages tracks, steps and playback
 * Continously invokes several callbacks 
 * onTick, invoked 4 times per step
 * onStep, invoked 4 times per bar and 16 times per track
 * onTrigger, invoked on active note at current step
 */
export default class StepSequencer {

    constructor(tracks, steps) {
        this.tracks = []
        this.steps = steps || 16
        for (let i=0; i<tracks; i++) {
            this.tracks.push(new Track(this.steps))
        }
        Object.seal(this.tracks)

        this.timer = new NanoTimer() // precision timer
        this.selectedTrack = 0 // for external use
        this.selectedStep = 0 // for external use
        this.step = 0 // current step, aka beat
        this.paused = true // playback status
        this.tick = 0 // current tick (4 per step)
        this.bpm = 0 // beats per minute use setBPM method
        this.delay = 0 // time between 2 ticks, calculated by setBPM method

        this._tick = this._tick.bind(this)

        // public callbacks
        this.onTick = null
        this.onPlay = null
        this.onPause = null
        this.onTrigger = null
        this.onStep = null
        
        // initialize BPM and delay
        this.setBPM(DEFAULT_BPM)
    }

    /**
     * tick callback. invoked 4 times per step
     * 
     */
    _tick() {
        if (this.onTick) this.onTick(this)
        if (!this.paused && this.tick%4==0) {
            // is at step / beat
            if (this.onStep) this.onStep(this)
            this.tracks.forEach((track, index) => {
                const vol = track.getVolume(this.step)
                const muted = track.getMuted(this.step)
                if (!muted && vol) {
                    if (this.onTrigger) this.onTrigger(index, vol)
                   
                }
            })
            this.step = wrap(++this.step, this.steps) // loop through steps
        }
        this.tick = wrap(++this.tick, this.steps*4) // loop through ticks
    }

    rewind() {
        this.tick = this.step = 0
    }    

    play() {
        if (this.onBeforePlay) this.onBeforePlay()
        this.paused = false
        if (this.onPlay) this.onPlay()
    }

    pause() {
        this.paused = true
        if (this.onPause) this.onPause()
    }

    togglePause() {
        if (this.paused) this.play()
        else this.pause()
    } 

    togglePlay() {
        if (this.paused) this.play()
        else this.stop()
    } 

    stop() {
        this.pause()
        this.rewind()

    }

    mute(track, step) {
        this.tracks[wrap(track, this.tracks.length)].mute(step)
    }

    unmute(track, step) {
        this.tracks[wrap(track, this.tracks.length)].unmute(step)
    }

    toggleMute(track, step) {
        this.tracks[wrap(track, this.tracks.length)].toggleMute(step)
    }

    setBPM(value) {
        this.bpm = value
        // delay per tick (4 beats per bar * 4 ticks per beat)
        this.delay = Math.round( 60000 / this.bpm  / 16) 
        // restart timer
        this.timer.clearInterval()
        this.timer.setInterval(this._tick,'', (this.delay+'m'))
    }

    getBPM() {
        return this.bpm
    }

    setVolume(track, step, value) {
        this.tracks[wrap(track, this.tracks.length)].setVolume(step, value)
    }

    getVolume(track, step) {
        return this.tracks[wrap(track, this.tracks.length)].getVolume(step)
    }

    getMuted(track, step) {
        return this.tracks[wrap(track, this.tracks.length)].getMuted(step)
    }
}