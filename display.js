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

    var pal_a2e  = [ "#000", "#d03", "#009", "#d2d",
                     "#072", "#555", "#22f", "#6af",
                     "#850", "#f60", "#aaa", "#f98",
                     "#1d0", "#ff0", "#4f9", "#fff" ];

    var pal_c64  = [ "#000", "#fff", "#800", "#afe",
                     "#c4c", "#0c5", "#00a", "#ee7",
                     "#d85", "#640", "#f77", "#333",
                     "#777", "#af6", "#08f", "#bbb" ];

    var pal_c64b = [ "#000", "#fff", "#800", "#6bb",
                     "#949", "#594", "#00a", "#dd6",
                     "#d73", "#640", "#d55", "#333",
                     "#777", "#5c5", "#47e", "#bbb" ];

    var pal_cga  = [ "#000", "#00a", "#0a0", "#0aa",
                     "#a00", "#a0a", "#a50", "#aaa",
                     "#555", "#55f", "#5f5", "#5ff",
                     "#f55", "#f5f", "#ff5", "#fff" ];

    var pal_win  = [ "#000", "#800", "#080", "#880",
                     "#008", "#808", "#088", "#ccc",
                     "#888", "#f00", "#0f0", "#ff0",
                     "#00f", "#f0f", "#0ff", "#fff" ];
    var pal_mono = [ "#000", "#111", "#222", "#333",
                     "#444", "#555", "#666", "#777",
                     "#888", "#999", "#aaa", "#bbb",
                     "#ccc", "#ddd", "#eee", "#fff" ];

    var palettes = {
        pal_a2e:  pal_a2e,
        pal_c64:  pal_c64,
        pal_c64b: pal_c64b,
        pal_cga:  pal_cga,
        pal_win:  pal_win,
        pal_mono: pal_mono
    };

    var palette = pal_win;


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

    function set_palette(pal) {
        palette = palettes[pal];
        refresh();
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
        set_palette: set_palette,
        refresh: refresh,
        reset: reset
    };
}

