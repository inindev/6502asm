//
//  6502 assembler and emulator in Javascript - RAM Emulation
//  John Clark - https://github.com/inindev/6502asm
//
//  Released under the GNU General Public License
//  see http://gnu.org/licenses/gpl.html
//
//

//
// read and write bytes to random access memory
// all operations and units in bytes except for read_word
//

function RAM(bytes)
{
    'use strict';

    var u8Array = new Uint8Array(bytes);

    var read_hook_addr_begin = 0;
    var read_hook_addr_end = 0;
    var read_hook_callback = null;

    var write_hook_addr_begin = 0;
    var write_hook_addr_end = 0;
    var write_hook_callback = null;


    function read(addr) {
        if((addr >= read_hook_addr_begin) && (addr <= read_hook_addr_end) && (typeof read_hook_callback === "function")) {
            return (read_hook_callback(addr) & 0xff);
        }
        return u8Array[addr];
    }

    // little endian read
    function read_word(addr) {
        var bl = read(addr);
        var bh = read(addr + 1) << 8;
        return (bh | bl);
    }

    function write(addr, val) {
        u8Array[addr] = val;
        if((addr >= write_hook_addr_begin) && (addr <= write_hook_addr_end) && (typeof write_hook_callback === "function")) {
            write_hook_callback(addr, (val & 0xff));
        }
    }

    // memory read callback hook
    //   read_hook(0xfe, 0xfe, function(addr))
    //   set callback to null to clear
    function read_hook(addr_begin, addr_end, callback) {
        if( (typeof callback !== "function") ||
            (addr_begin < 0) ||
            (addr_begin > addr_end) ||
            (addr_end >= u8Array.length) )
        {
            read_hook_addr_begin = 0;
            read_hook_addr_end = 0;
            read_hook_callback = null;
            return;
        }

        read_hook_addr_begin = addr_begin;
        read_hook_addr_end = addr_end;
        read_hook_callback = callback;
    }

    // memory write callback hook
    //   write_hook(0x0200, 0x5ff, function(addr, val))
    //   set callback to null to clear
    function write_hook(addr_begin, addr_end, callback) {
        if( (typeof callback !== "function") ||
            (addr_begin < 0) ||
            (addr_begin > addr_end) ||
            (addr_end > u8Array.length) )
        {
            write_hook_addr_begin = 0;
            write_hook_addr_end = 0;
            write_hook_callback = null;
            return;
        }

        write_hook_addr_begin = addr_begin;
        write_hook_addr_end = addr_end;
        write_hook_callback = callback;
    }

    // reset all RAM to zero
    function reset() {
        u8Array.fill(0);
    }

    return {
        read: read,
        read_word: read_word,
        write: write,
        read_hook: read_hook,
        write_hook: write_hook,
        reset, reset
    };
}
