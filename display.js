//
//  6502 assembler and emulator in Javascript - Display Emulation
//  John Clark - https://github.com/inindev/6502asm
//
//  Released under the GNU General Public License
//  see http://gnu.org/licenses/gpl.html
//


function Display(ram)
{
    'use strict';

    var ram = ram;

    var addr_begin = 0;
    var addr_end = 0;

    var palette = [ "#000000", "#ffffff", "#880000", "#aaffee",
                    "#cc44cc", "#00cc55", "#0000aa", "#eeee77",
                    "#dd8855", "#664400", "#ff7777", "#333333",
                    "#777777", "#aaff66", "#0088ff", "#bbbbbb" ];

    function set_resolution(canvas, width, height, base_addr) {
        var context = canvas.getContext('2d');
        context.fillStyle = "#000000";
        context.fillRect(0, 0, canvas.width, canvas.height);

        var pixelWidth = Math.floor(canvas.width / width);
        var pixelHeight = Math.floor(canvas.height / height);

        addr_begin = base_addr;
        addr_end = (width * height + addr_begin - 1);

        ram.write_hook(addr_begin, addr_end, function(addr, val) {
            context.fillStyle = palette[val & 0x0f];
            var x = (addr - addr_begin) % width;
            var y = Math.floor((addr - addr_begin) / height);
            context.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth, pixelHeight);
        });
    }

    function refresh() {
        for(var i=addr_begin; i<=addr_end; i++) {
            var val = ram.read(i);
            ram.write(i, val);
        }
    }

    function reset() {
        for(var i=addr_begin; i<=addr_end; i++) {
            ram.write(i, 0);
        }
    }

    return {
        set_resolution: set_resolution,
        refresh: refresh,
        reset: reset
    };
}

