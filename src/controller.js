const TRANSPORT_INDEX = 19 // Play Status
const TRACK_INDEX = 18
const TEMPO_INDEX = 17
const MASTER_INDEX = 16 // Master Volume
const MODE_LED_OFFSET = 5 // Offest of mode leds in the ring
const STEP_COUNT = 16 // sequencer steps
const MODE_COUNT = 4 // modes
const INDEX_COUNT = STEP_COUNT + MODE_COUNT // Indices / LEDs used
const DEFAULT_MIN_TEMPO = 52 // bpm
const BLINK_INTERVAL = 400

/**
 * Handle User Interaction with smart switch and manage status display using LED Ring and Center LED of SmartSwitch
 */
export default class Controller {
    constructor(smartSwitch, sequencer, sampler, colors) {
        this.verbose = false
        this.smartSwitch = smartSwitch
        this.sequencer = sequencer
        this.sampler = sampler
        this.colors = colors
        this.mode = Controller.TRANSPORT
        this.index = TRANSPORT_INDEX // cursor at transport
        this.minTempo = DEFAULT_MIN_TEMPO // bpm
        this.capture = false
        this.blink = true
        this.velocityChanged = false
        
        setInterval(
            () => {
                this.blink = !this.blink; this.update()
            }, 
            BLINK_INTERVAL
        )

        this.smartSwitch.onEncoder = (left,right,pressed,value) => {
            if (this.verbose) console.log(left,right,pressed,value)
        }
        
        this.smartSwitch.onRight = (down) => {
            if (this.verbose) console.log('onRight', down)
            if (this.mode === Controller.TRANSPORT) {
                if (!down) {
                    this.index = (this.index + 1) % INDEX_COUNT
                    this.update()
                }
            } else if (this.mode == Controller.TRACK) {
                this.sequencer.selectedTrack = (this.sequencer.selectedTrack + 1) % this.sequencer.tracks.length
                this.update()
            } else if (this.mode == Controller.TEMPO) {
                let tempoIndex = ((this.sequencer.getBPM()-this.minTempo)/8)|0
                tempoIndex = Math.min(16, tempoIndex + 1)
                this.sequencer.setBPM(this.minTempo + (tempoIndex) * 8)
                this.update()
            } else if (this.mode === Controller.VELOCITY) {
                let vol = (this.sequencer.getVolume(this.sequencer.selectedTrack, this.sequencer.selectedStep) * 16) | 0
                vol = Math.min(16, vol + 1)
                this.sequencer.setVolume(this.sequencer.selectedTrack, this.sequencer.selectedStep, vol/16)
                this.velocityChanged = true // keep track of vel change to distinguish from step click
                this.update()
            } else if (this.mode === Controller.MASTER) {
                let vol = this.sampler.volume * 16 | 0
                vol = Math.min(16, vol + 1)
                this.sampler.volume = vol/16
                this.update()
            }
        }

        this.smartSwitch.onLeft = (down) => {
            if (this.verbose) console.log('onLeft', down)
            if (this.mode === Controller.TRANSPORT) {
                if (!down) {
                    this.index = (INDEX_COUNT + this.index - 1) % INDEX_COUNT
                    this.update()
                }
            } else if (this.mode === Controller.TRACK) {
                this.sequencer.selectedTrack = (this.sequencer.tracks.length + this.sequencer.selectedTrack - 1) % this.sequencer.tracks.length
                this.update()
            } else if (this.mode === Controller.TEMPO) {
                let tempoIndex = ((this.sequencer.getBPM()-this.minTempo)/8)|0
                tempoIndex = Math.max(1, tempoIndex - 1)
                this.sequencer.setBPM(this.minTempo + (tempoIndex) * 8)
                this.update()
            } else if (this.mode === Controller.VELOCITY) {
                let vol = (this.sequencer.getVolume(this.sequencer.selectedTrack, this.sequencer.selectedStep) * 16) | 0
                vol = Math.max(1, vol - 1)
                this.sequencer.setVolume(this.sequencer.selectedTrack, this.sequencer.selectedStep, vol/16)
                this.velocityChanged = true // keep track of vel change to distinguish from step click
                this.update()
            } else if (this.mode === Controller.MASTER) {
                let vol = this.sampler.volume * 16 | 0
                vol = Math.max(0, vol - 1)
                this.sampler.volume = vol/16
                this.update()
            }
        }

        this.smartSwitch.onDown = () => {
            if (this.verbose) console.log('onDown')
            this.capture = false
            this.velocityChanged = false
            if (this.mode === Controller.TRANSPORT) {
                if (this.index < STEP_COUNT) {
                    this.mode = Controller.VELOCITY
                    this.sequencer.selectedStep = this.index
                    this.update()
                
                } else if (this.index == TRACK_INDEX) {
                    console.log("select track")
                    this.mode = Controller.TRACK
                    this.update()
                } else if (this.index == TEMPO_INDEX) {
                    console.log("change tempo")
                    this.mode = Controller.TEMPO
                    this.update()
                } else if (this.index == MASTER_INDEX) {
                    console.log("set master volume")
                    this.mode = Controller.MASTER
                    this.update()
                }
            }
        }

        this.smartSwitch.onUp = () => {
            if (this.verbose) console.log('onUp')
            if (this.mode === Controller.TRACK) {
                this.mode = Controller.TRANSPORT
                this.update()
            } else if (this.mode === Controller.TEMPO) {
                this.mode = Controller.TRANSPORT
                this.update()
            } else if (this.mode === Controller.VELOCITY) {
                this.mode = Controller.TRANSPORT
                if (this.velocityChanged) {     
                    let muted = this.sequencer.getMuted(this.sequencer.selectedTrack, this.sequencer.selectedStep) 
                    let vol = this.sequencer.getVolume(this.sequencer.selectedTrack, this.sequencer.selectedStep)
                    if (muted && vol || !vol && !muted) this.sequencer.toggleMute(this.sequencer.selectedTrack, this.sequencer.selectedStep) 
                    this.capture = true // keep track to prevent click
                }
                this.update()
            } else if (this.mode === Controller.MASTER) {
                this.mode = Controller.TRANSPORT
                this.update()
            }
        }

        this.smartSwitch.onClick = () => {
            if (this.verbose) console.log('onClick')
            if (!this.capture) {
                if (this.mode === Controller.TRANSPORT) {
                    if (this.index == TRANSPORT_INDEX) {
                        this.sequencer.togglePlay()
                    } else if (this.index<STEP_COUNT) {
                        this.sequencer.toggleMute(this.sequencer.selectedTrack, this.index)
                    }
                    this.update()
                }
            }
        }



        this.update() // initialize LEDs
    }
    
    /**
     * Main Update Loop. Calculates LED Colors and 
     */
    update() {
        //if ((this.sequencer.tick)%8 == 0) this.blink = !this.blink
        let ledSet = new Set()
        let r = 0
        let g = 0
        let b = 0
        if (this.mode === Controller.TRANSPORT) {
            // Transport Mode. Shows steps of currently selected track and playback status. Active while knob is not pressed.
            r = this.colors[this.sequencer.selectedTrack].r 
            g = this.colors[this.sequencer.selectedTrack].g 
            b = this.colors[this.sequencer.selectedTrack].b 
            this.sequencer.tracks[this.sequencer.selectedTrack].steps.forEach((step, index) => {
                if(!step.getMuted() && step.getVolume()) ledSet.add(index)
            })

            // shift index for the mode selectors (cause of unused leds in between)
            let indexOffset = 0
            if (this.index >= STEP_COUNT) {
                indexOffset = MODE_LED_OFFSET
            }
            // render cursor
            if(this.blink) ledSet.add(this.index + indexOffset)
            else ledSet.delete(this.index + indexOffset)
        } else if (this.mode === Controller.TRACK) {
            // Track selection Mode. Active while cursor over track selection and knob is pressed
            r = this.colors[this.sequencer.selectedTrack].r 
            g = this.colors[this.sequencer.selectedTrack].g
            b = this.colors[this.sequencer.selectedTrack].b
            ledSet.add(this.sequencer.selectedTrack)
            // switch on track selector led
            ledSet.add(TRACK_INDEX + MODE_LED_OFFSET)
        } else if (this.mode === Controller.TEMPO) {
            // Mode to set the global playback tempo. Active while cursor over tempo selection and knob is pressed.
            const tempoIndex = ((this.sequencer.getBPM()-this.minTempo)/8)|0
            r = 0xFF
            g = 0xFF
            b = 0xFF
            for (let i = 0; i< tempoIndex; i++) {
                ledSet.add(i)
            }
            // switch on tempo selector led
            ledSet.add(TEMPO_INDEX + MODE_LED_OFFSET)
        } else if (this.mode === Controller.VELOCITY) {
            // Mode to set volume per note. Active while cursor at step and the knob is pressed.
            const vol = this.sequencer.getVolume(this.sequencer.selectedTrack, this.sequencer.selectedStep)
            r = (this.colors[this.sequencer.selectedTrack].r * vol) | 0
            g = (this.colors[this.sequencer.selectedTrack].g * vol) | 0
            b = (this.colors[this.sequencer.selectedTrack].b * vol) | 0
            for (let i = 0; i< (vol * 16) | 0; i++) {
                ledSet.add(i)
            }

        } else if (this.mode === Controller.MASTER) {
            // Mode to set volume per note. Active while cursor at step and the knob is pressed.
            const vol = this.sampler.volume
            r = vol * 0xFF
            g = vol * 0xFF
            b = vol * 0xFF
            for (let i = 0; i< (vol * 16) | 0; i++) {
                ledSet.add(i)
            }
            // switch on master volume led
            ledSet.add(MASTER_INDEX + MODE_LED_OFFSET)

        }
        
        // finally pass over to smartswitch instance. Only necessary changes will be sent to device.
        if (this.sequencer.paused) {
            // when paused, switch off center led
            this.smartSwitch.setCenter(0,0,0)
        } else {
            // otherwise switch it on
            this.smartSwitch.setCenter(255,255,255)
        }
        // set the current ring status
        this.smartSwitch.setRing(ledSet, r, g, b)
    }
}

// Supported Modes
Controller.TRANSPORT = "transport"
Controller.TEMPO = "tempo"
Controller.TRACK = "track"
Controller.SEQUENCE = "sequence"
Controller.VELOCITY = "velocity"
Controller.MASTER = "master"