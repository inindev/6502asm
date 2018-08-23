
//
// read and write bytes to random access memory
// all operations and units in bytes except for read_word
//

function Ram(bytes)
{
    var byteArray = new Array(bytes);

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
        return (byteArray[addr] & 0xff);
    }

    function read_word(addr) {
        var bl = read(addr);
        var bh = read(addr + 1) << 8;
        return (bh | bl);
    }

    function write(addr, val) {
        var bv = (val & 0xff);
        byteArray[addr] = bv;
        if((addr >= write_hook_addr_begin) && (addr <= write_hook_addr_end) && (typeof write_hook_callback === "function")) {
            write_hook_callback(addr, bv);
        }
    }

    // memory read callback hook
    // read_hook(0xfe, 0xfe, function(addr))
    // set callback to null to clear
    function read_hook(addr_begin, addr_end, callback) {
        if( (typeof callback !== "function") ||
            (addr_begin < 0) ||
            (addr_begin > addr_end) ||
            (addr_end >= byteArray.length) )
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
    // write_hook(0x0200, 0x5ff, function(addr, val))
    // set callback to null to clear
    function write_hook(addr_begin, addr_end, callback) {
        if( (typeof callback !== "function") ||
            (addr_begin < 0) ||
            (addr_begin > addr_end) ||
            (addr_end > byteArray.length) )
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

    // clear ZP, stack and screen
    function reset() {
        for(var i=0; i<byteArray.length; i++) {
            byteArray[i] = 0x00;
        }
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
