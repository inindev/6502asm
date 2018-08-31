//
//  6502 assembler and emulator in Javascript - MainApp Scripts
//  John Clark - https://github.com/inindev/6502asm
//
//  Released under the GNU General Public License
//  see http://gnu.org/licenses/gpl.html
//


class MainApp
{
    constructor() {
        if(document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", this.init.bind(this));
        } else {
            this.init();
        }
    }

    init() {
        this.is_compiled = false;
        this.is_running = false;

        this.toolbar = {
            compile: document.querySelector("div.toolbar>input[value=Compile]"),
            run: document.querySelector("div.toolbar>input[value=Run]"),
            reset: document.querySelector("div.toolbar>input[value=Reset]"),
            hexdump: document.querySelector("div.toolbar>input[value=Hexdump]"),
            disassemble: { disabled: true }, // dummy stub-out
            file_select: document.querySelector("div.toolbar>select")
        };

        this.toolbar.compile.addEventListener("click", this.on_compile_code.bind(this));
        this.toolbar.run.addEventListener("click", this.on_toggle_run_code.bind(this));
        this.toolbar.reset.addEventListener("click", reset.bind(this));
        this.toolbar.hexdump.addEventListener("click", hexDump.bind(this));

        this.editor = document.querySelector("textarea.editor");

        this.toolbar.file_select.addEventListener("change", this.on_load_file.bind(this));
        document.querySelector("div.screen_res").addEventListener("change", this.on_set_resolution.bind(this));
        document.querySelector("div.palette").addEventListener("change", this.on_set_palette.bind(this));

        // store keycode in ZP $ff
        document.addEventListener('keypress', this.on_key_press.bind(this));

        // random number generator at ZP $fe
        ram.read_hook(0x00fe, 0x00fe, this.on_random_read.bind(this));

        // initial toolbar button states
        this.update_button_states(false, false);

        // 32x32 display
        var rbtn = document.querySelector("input[name=res]:checked");
        if(rbtn) {
            rbtn.checked = false;
        }
        else {
            rbtn = document.getElementById("32");
        }
        rbtn.click();

        // commodore 64 palette
        document.querySelector("div.palette>select").value = "pal_c64";
        display.set_palette("pal_c64");
    }


    // TODO: disable Run and Debug buttons when text is altered in the code editor
    update_button_states(is_compiled, is_running) {
        this.is_compiled = is_compiled;
        this.is_running = is_running;

        if(!this.is_compiled) {
            this.toolbar.compile.disabled = false;
            this.toolbar.run.disabled = true;
            this.toolbar.run.value = "Run";
            this.toolbar.reset.disabled = true;
            this.toolbar.hexdump.disabled = true;
            this.toolbar.disassemble.disabled = true;
            this.toolbar.file_select.disabled = false;
            return;
        }

        // code is compiled, are we running?
        this.toolbar.compile.disabled = true;
        this.toolbar.run.disabled = false;
        this.toolbar.reset.disabled = false;
        this.toolbar.hexdump.disabled = false;
        this.toolbar.disassemble.disabled = false;

        if(this.is_running) {
            this.toolbar.file_select.disabled = true;
            this.toolbar.run.value = "Stop";
        }
        else {
            this.toolbar.file_select.disabled = false;
            this.toolbar.run.value = "Run";
        }
    }


    //
    // event handlers
    //
    on_compile_code(event) {
        this.update_button_states(false, false);

        let code = this.editor.value;
        const is_compiled = compileCode(code);
        this.update_button_states(is_compiled, false);
    }

    on_toggle_run_code(event) {
        const new_state = !this.is_running;
        cpu.set_running(new_state);
        this.update_button_states(true, new_state);  // TODO: callback for code stop
    }

    on_set_resolution(event) {
        const screen = document.querySelector("canvas.screen");
        const registers = document.querySelector("div.registers");

        const res = parseInt(event.target.id, 10);
        switch(res) {
            case 32:
                screen.width = 384;   // 12 * 32
                screen.height = 288;  //  9 * 32
                registers.setAttribute("style","height:92px; width:384px");
                display.set_resolution(screen, 32, 32, 0x0200);
                break;
            case 48:
                screen.width = 384;   //  8 * 48
                screen.height = 288;  //  6 * 48
                registers.setAttribute("style","height:92px; width:384px");
                display.set_resolution(screen, 48, 48, 0x2000);
                break;
            case 64:
                screen.width = 384;   //  6 * 64
                screen.height = 256;  //  4 * 64
                registers.setAttribute("style","height:124px; width:384px");
                display.set_resolution(screen, 64, 64, 0x2000);
                break;
            case 80: // leave this?
                screen.width = 400;   //  5 * 80
                screen.height = 240;  //  3 * 80
                registers.setAttribute("style","height:140px; width:400px");
                display.set_resolution(screen, 80, 80, 0x2000);
                break;
            case 96:
                screen.width = 384;   //  4 * 96
                screen.height = 288;  //  3 * 96
                registers.setAttribute("style","height:92px; width:384px");
                display.set_resolution(screen, 96, 96, 0x2000);
                break;
            case 128:
                screen.width = 384;   //  3 * 128
                screen.height = 256;  //  2 * 128
                registers.setAttribute("style","height:124px; width:384px");
                display.set_resolution(screen, 128, 128, 0x2000);
                break;
            default:
                break;          
        }

        display.refresh();
    }

    on_set_palette(event) {
        display.set_palette(event.target.value);
    }

    // store keycode in ZP $ff
    on_key_press(event) {
        var value = event.which;
        ram.write(0xff, value);
    }

    // random number generator at ZP $fe
    on_random_read(addr) {
        return Math.floor(Math.random() * 256);
    }

    on_load_file(event) {
        reset();
        this.update_button_states(false, false);

        this.editor.value = "loading, please wait...";
        this.toolbar.compile.disabled = true;

        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if(xhr.readyState === 4 && xhr.status === 200) {
                this.editor.value = xhr.responseText;
                this.toolbar.compile.disabled = false;
            }
        };
        const file = event.target.value;
        xhr.open("GET", "examples/" + file);
        xhr.send(null);
    }
}


const main_app = new MainApp();
export default main_app;

