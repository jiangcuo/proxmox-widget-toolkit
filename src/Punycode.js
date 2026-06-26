Ext.ns('Proxmox');

Ext.define('Proxmox.Punycode', {
    singleton: true,

    maxInt: 2147483647,
    base: 36,
    tMin: 1,
    tMax: 26,
    skew: 38,
    damp: 700,
    initialBias: 72,
    initialN: 128,
    delimiter: '-',

    clonePrefix: 'Copy-of-VM-',

    decodeDigit: function (code) {
        if (code >= 48 && code < 58) {
            return code - 48 + 26;
        } else if (code >= 65 && code < 91) {
            return code - 65;
        } else if (code >= 97 && code < 123) {
            return code - 97;
        }
        return this.base;
    },

    encodeDigit: function (digit) {
        return String.fromCharCode(digit < 26 ? 97 + digit : 22 + digit);
    },

    adaptBias: function (delta, numPoints, firstTime) {
        let me = this;
        delta = firstTime ? Math.floor(delta / me.damp) : delta >> 1;
        delta += Math.floor(delta / numPoints);

        let k = 0;
        while (delta > Math.floor(((me.base - me.tMin) * me.tMax) / 2)) {
            delta = Math.floor(delta / (me.base - me.tMin));
            k += me.base;
        }

        return k + Math.floor(((me.base - me.tMin + 1) * delta) / (delta + me.skew));
    },

    hasNonAscii: function (text) {
        // eslint-disable-next-line no-control-regex
        return typeof text === 'string' && /[^\0-\x7F]/.test(text);
    },

    hasControlChars: function (text) {
        return /[\x00-\x1F\x7F-\x9F]/.test(text);
    },

    decodePunycode: function (input) {
        let me = this;
        let output = [];
        let n = me.initialN;
        let bias = me.initialBias;
        let i = 0;
        let lastDelim = input.lastIndexOf(me.delimiter);
        let index = 0;

        if (lastDelim !== -1) {
            for (let pos = 0; pos < lastDelim; pos++) {
                let code = input.charCodeAt(pos);
                if (code >= 0x80) {
                    throw 'invalid basic code point';
                }
                output.push(code);
            }
            index = lastDelim + 1;
        }

        while (index < input.length) {
            let oldI = i;
            let w = 1;

            for (let k = me.base; ; k += me.base) {
                if (index >= input.length) {
                    throw 'invalid input';
                }

                let digit = me.decodeDigit(input.charCodeAt(index++));
                if (digit >= me.base) {
                    throw 'invalid digit';
                }

                i += digit * w;
                if (i > me.maxInt) {
                    throw 'overflow';
                }

                let t;
                if (k <= bias) {
                    t = me.tMin;
                } else if (k >= bias + me.tMax) {
                    t = me.tMax;
                } else {
                    t = k - bias;
                }

                if (digit < t) {
                    break;
                }

                w *= me.base - t;
                if (w > me.maxInt) {
                    throw 'overflow';
                }
            }

            let outLen = output.length + 1;
            bias = me.adaptBias(i - oldI, outLen, oldI === 0);
            n += Math.floor(i / outLen);
            i %= outLen;

            if (n > 0x10ffff || n > me.maxInt) {
                throw 'invalid code point';
            }
            output.splice(i, 0, n);
            i++;
        }

        return String.fromCodePoint.apply(String, output);
    },

    encodePunycode: function (input) {
        let me = this;
        let codepoints = Array.from(input, (ch) => ch.codePointAt(0));
        let output = '';
        let handled = 0;

        codepoints.forEach(function (codepoint) {
            if (codepoint < 0x80) {
                output += String.fromCharCode(codepoint);
                handled++;
            }
        });

        let basicCount = handled;
        if (basicCount > 0) {
            output += me.delimiter;
        }

        let n = me.initialN;
        let delta = 0;
        let bias = me.initialBias;

        while (handled < codepoints.length) {
            let m = Infinity;
            codepoints.forEach(function (codepoint) {
                if (codepoint >= n && codepoint < m) {
                    m = codepoint;
                }
            });

            if (m === Infinity) {
                throw 'no code point found';
            }

            delta += (m - n) * (handled + 1);
            if (delta > me.maxInt) {
                throw 'overflow';
            }
            n = m;

            codepoints.forEach(function (codepoint) {
                if (codepoint < n) {
                    delta++;
                    if (delta > me.maxInt) {
                        throw 'overflow';
                    }
                }
                if (codepoint !== n) {
                    return;
                }

                let q = delta;
                for (let k = me.base; ; k += me.base) {
                    let t;
                    if (k <= bias) {
                        t = me.tMin;
                    } else if (k >= bias + me.tMax) {
                        t = me.tMax;
                    } else {
                        t = k - bias;
                    }

                    if (q < t) {
                        break;
                    }

                    output += me.encodeDigit(t + ((q - t) % (me.base - t)));
                    q = Math.floor((q - t) / (me.base - t));
                }

                output += me.encodeDigit(q);
                bias = me.adaptBias(delta, handled + 1, handled === basicCount);
                delta = 0;
                handled++;
            });

            delta++;
            if (delta > me.maxInt) {
                throw 'overflow';
            }
            n++;
        }

        return output;
    },

    decodeRaw: function (input) {
        if (typeof input !== 'string' || input === '') {
            return input;
        }

        try {
            let decoded = this.decodePunycode(input);
            return this.hasControlChars(decoded) ? input : decoded;
        } catch (_e) {
            return input;
        }
    },

    decode: function (input) {
        if (
            typeof input !== 'string' ||
            input === '' ||
            !input.toLowerCase().startsWith('xn--')
        ) {
            return input;
        }

        return this.decodeRaw(input.slice(4));
    },

    encode: function (input) {
        if (typeof input !== 'string' || input === '' || !this.hasNonAscii(input)) {
            return input;
        }

        try {
            return `xn--${this.encodePunycode(input)}`;
        } catch (_e) {
            return input;
        }
    },

    decodeDomain: function (domain) {
        if (typeof domain !== 'string' || domain === '') {
            return domain;
        }

        return domain
            .split('.')
            .map((label) => (label.toLowerCase().startsWith('xn--') ? this.decode(label) : label))
            .join('.');
    },

    encodeDomain: function (domain) {
        if (typeof domain !== 'string' || domain === '') {
            return domain;
        }

        return domain.split('.').map((label) => this.encode(label)).join('.');
    },

    decodeVmName: function (name) {
        if (typeof name !== 'string' || name === '') {
            return name;
        }

        if (name.toLowerCase().startsWith('xn--')) {
            return this.decode(name);
        }

        // Do not decode arbitrary "foo-xn--bar-baz" substrings: punycode
        // labels are not self-delimiting once embedded in a larger ASCII name.
        // PVE clone names are the known exception, where the prefix is fixed
        // and the rest is the original encoded guest name.
        if (!name.startsWith(this.clonePrefix)) {
            return name;
        }

        let suffix = name.slice(this.clonePrefix.length);
        if (!suffix.toLowerCase().startsWith('xn--')) {
            return name;
        }

        let decoded = this.decode(suffix);
        return decoded === suffix ? name : `${this.clonePrefix}${decoded}`;
    },

    decodeText: function (text) {
        if (typeof text !== 'string' || text.toLowerCase().indexOf('xn--') === -1) {
            return text;
        }

        return text
            .split(/(\s+)/)
            .map((part) => {
                let match = /^([("'\[]?)(.*?)([)"'\],.;:]?)$/.exec(part);
                if (!match) {
                    return part;
                }

                let decoded = this.decodeVmName(match[2]);
                return decoded === match[2] ? part : `${match[1]}${decoded}${match[3]}`;
            })
            .join('');
    },
});
