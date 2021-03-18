// external dependencies
import { BitView } from 'bit-buffer' // bit-buffer utilized to acces ByteArrays bitwise
import HID from 'node-hid' // USB Device Library

const DEFAULT_VID = 0x0483 // smartswitch vendor id
const DEFAULT_PID = 0x5750 // smartswitch product id
const USB_DISCOVERY_POLL_INTERVAL = 3000 // msec (beware, don't go to fast)
const USB_READY_TIMEOUT = 500 // msec, time to wait after HID initialization (windows hotfix 1)

export default class SmartSwitch {
    constructor(vid, pid) {
        this.vid = vid || DEFAULT_VID
        this.pid = pid || DEFAULT_PID
        this.hid = null
        this.hidReady = false
        
        // used to keep track of switch status
        this.left = false
        this.right = false
        this.pressed = false
        this.value = 0
        this.stationary = false

        // public callback methods, to listen to events
        this.onEncoder = null // on knob encoder data
        this.onStatus = null // on status report messages
        this.onRotate = null // on actual rotation of knob
        this.onDown = null // invoked when knob enters down state
        this.onUp = null // invoked when knob is released 
        this.onClick = null // invoked when knob is released while not rotated meanwhile
        this.onLeft = null // when turned left
        this.onRight = null // when turned right
        this.onConnect = null // called when smart switch is connected
        this.onDisconnect = null // called when smart switch is disconnected

        // send buffers will be stored to check
        this.ringBuffer
        this.centerBuffer

        // initialize Buffers
        this._resetBuffers()

        // Polling for USB Device changes
        this._pollTimeout
        this._poll = this._poll.bind(this)

        this._onConnect = this._onConnect.bind(this)

        setImmediate(this._poll) // start poll with next cycle
    }

    destroy() {
        this._pollTimeout = clearTimeout(this._pollTimeout)
        this._disconnect()
    }

    /**
     * Poll for smart switch
     * THIS IS EXPENSIVE AND BLOCKING!
     * Request OS to enumerate USB Device
     */
    _poll() {
        console.log('Polling for SmartSwitch')
        this._pollTimeout = clearTimeout(this._pollTimeout)
        if (HID.devices().find(o => o.vendorId == this.vid && o.productId == this.pid)) {
            console.log('Found SmartSwitch')
            this._connect()
        } else {
            this._pollTimeout = setTimeout(this._poll, USB_DISCOVERY_POLL_INTERVAL)
        }
    }

    /**
     * Initialize buffers
     */
    _resetBuffers() {
        this.ringBuffer = Buffer.alloc(1)
        this.centerBuffer = Buffer.alloc(1)
    }

    /**
     * Connect to smart switch
     */
    _connect() {
        if (this.hid) return 
        try {
            console.log("Connecting to SmartSwitch")
            this.hid = new HID.HID(this.vid,this.pid)
            this.hid.on("data", this._onData.bind(this))
            this.hid.on("error", this._onError.bind(this))
            setTimeout(this._onConnect, USB_READY_TIMEOUT)
        } catch (err) {
            console.error(err)
        }
    }

    _onConnect() {
        console.log("SmartSwitch connected")
        this.hidReady = true
        if (this.onConnect) this.onConnect()
    }

    /**
     * Disconnect smart switch
     */
    _disconnect() {
        this.hidReady = false
        if (!this.hid) return 
        try {
            this.hid.close()
        } catch (err) {
            console.error(err)
        }
        this.hid = null
        this._resetBuffers()
        if (this.onDisconnect) this.onDisconnect()
        this._poll()
    }

    /**
     * Handle stream read errors
     * @param {S} err 
     */
    _onError(err) {
        this._disconnect()
        console.error(err)
    }

    /**
     * Handle stream datas
     * @param {Buffer} buffer 
     */
    _onData(buffer) {
        const reportId = buffer.readInt8(0)
        switch (reportId) {
            case 1:
                this._onStatus(buffer)
                break
            case 2:
                const bufferBV = new BitView(buffer,1,2)
                this._onEncoder(
                    !!bufferBV.getBits(0,1,false), // left
                    !!bufferBV.getBits(1,1,false), // right
                    !!bufferBV.getBits(2,1,false), // pressed
                    bufferBV.getInt8(8) // value
                )
                break
            }
    }

    /**
     * private status callback
     */
    _onStatus() {
        if (this.onStatus) this.onStatus()
    }

    /**
     * private encoder callback
     */
    _onEncoder(left, right, pressed, value) {
        if (this.onEncoder) this.onEncoder(left, right, pressed, value)
        const _pLeft = this.left
        const _pRight = this.right
        const _pPressed = this.pressed 

        this.left = left
        this.right = right
        this.pressed = pressed
        this.value = value

        if (!_pPressed && this.pressed) this._onDown()
        if (_pPressed && !this.pressed) this. _onUp()
        if (_pLeft != this.left || _pRight != this.right) this._onRotate(this.value, this.pressed)
    }

    /**
     * private rotate callback
     */
    _onRotate(dir, pressed) {
        if (this.onRotate) this.onRotate(dir, pressed)
        if (dir<0) this._onLeft(pressed)
        else if (dir>0) this._onRight(pressed)
    }

    _onLeft(pressed) {
        if (this.onLeft) this.onLeft(pressed)
        this.stationary = false
    }

    _onRight(pressed) {
        if (this.onRight) this.onRight(pressed)
        this.stationary = false
    }

    _onDown() {
        if (this.onDown) this.onDown()
        this.stationary = true
    }

    _onUp() {
        if (this.onUp) this.onUp()
        if (this.stationary) this._onClick()
    }

    _onClick() {
        this.stationary = false
        if (this.onClick) this.onClick()
    }
    
    /**
     * Set LED Ring, LEDs that are indexed in ledSet will be switched on
     * @param {Set} ledSet 
     * @param {uint} r 
     * @param {uint} g 
     * @param {uint} b 
     */
    setRing(ledSet, r, g, b) {
        const ringBuffer = Buffer.alloc(7+1)
        const ringBufferBV = new BitView(ringBuffer)
        const h = 8
        const rid = 0x3
        ringBufferBV.setUint8(0, rid)
        ringBufferBV.setUint8(0 + h, r)
        ringBufferBV.setUint8(8 + h, g)
        ringBufferBV.setUint8(16 + h, b)
        ledSet.forEach((value) => {
            var mult = (value/8)|0
            ringBufferBV.setBits( 6 * 8-(mult * 8 - (value%8)) + h, 1, 1 )
        })
        if (this.hid && this.hidReady && ringBuffer.compare(this.ringBuffer) != 0) {
            // only if device connected and ringBuffer changed
            this.ringBuffer = ringBuffer
            try {
                // sending feature report to device (windows hotfix 2: convert to array)
                this.hid.sendFeatureReport(ringBuffer)
            } catch (err) {
                console.error(err)
            }
        }
    }

    /**
     * Set Centered LED. No colors possible due to device restrictions.
     * Pass any color to switch on
     * Pass black r = g = b = 0 to switch off
     * @param {uint} r 
     * @param {uint} g 
     * @param {uint} b 
     */
    setCenter(r, g, b) {
        const centerBuffer = Buffer.alloc(4+1)
        const centerBufferBV = new BitView(centerBuffer)
        const h = 8
        const rid = 0x4
        centerBufferBV.setUint8(0, rid)
        centerBufferBV.setUint8(0 + h, r)
        centerBufferBV.setUint8(8 + h, g)
        centerBufferBV.setUint8(16 + h, b)
        centerBufferBV.setBits(24 + h, (r|g|b) && 1, 1 )
        if (this.hid && this.hidReady && centerBuffer.compare(this.centerBuffer) != 0) {
            // only if device connected and centerBuffer changed
            this.centerBuffer = centerBuffer
            try {
                // sending feature report to device (windows hotfix 2: convert to array)
                this.hid.sendFeatureReport(centerBuffer)
            } catch (err) {
                console.error(err)
            }
        }
    }

    /**
     * Start Actuator by passing a pattern
     *  
     * @param {Array} patterns 
     * 4 Patterns with 16 steps, repeat 0 to ignore
     * [
     *    {steps:[1,0,1,0, 1,1,1,0, 0,0,0,0, 0,0,0,0], repeat:1},
     *    {steps:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], repeat:0},
     *    {steps:[1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0], repeat:0},
     *    {steps:[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], repeat:0}
     * ],
     * @param {int} globalRepeat repeats all patterns subsequently
     * @param {int} tempo min 0 max 254, the higher the faster
     */
    setMotor(patterns, globalRepeat, tempo) {
        const motorBuffer = Buffer.alloc(14+1)
        const motorBufferBV = new BitView(motorBuffer)
        const h = 8
        const rid = 0x5
        motorBufferBV.setUint8(0, rid)
        patterns.forEach((pattern, pIndex) => {
            pattern.steps.forEach((step, sIndex)=> {
                motorBufferBV.setBits(pIndex*16+sIndex + h, step, 1 )
            })
            motorBufferBV.setUint8(4*16+pIndex*8 + h, pattern.repeat)
        })
        motorBufferBV.setUint8(4*16 + 4*8 + h, globalRepeat)
        motorBufferBV.setUint8(4*16 + 4*8 + 8 + h, tempo)
        
        if (this.hid && this.hidReady) {
            // only if device connected
            try {
                // sending feature report to device (windows hotfix 2: convert to array)
                this.hid.sendFeatureReport(motorBuffer)
            } catch (err) {
                console.error(err)
            }
        }
    }
}
