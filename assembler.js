//
//  6502 assembler and emulator in Javascript
//  (C)2006-2009 Stian Soreng - www.6502asm.com
//
//  Released under the GNU General Public License
//  see http://gnu.org/licenses/gpl.html
//
//

/*jshint bitwise: false*/
/*jshint esversion: 6 */
"use strict";

var codeCompiledOK = false;
var regA = 0;
var regX = 0;
var regY = 0;
var regP = 0;
var regPC = 0x600;
var regSP = 0x100;
var ram = new RAM(0x10000); // 64k
var runForever = false;
var labelIndex = new Array();
var labelPtr = 0;
var codeRunning = false;
var codeLen = 0;
var myInterval;
var display = new Array(0x400);
var defaultCodePC = 0x600;
var palette = [ "#000000", "#ffffff", "#880000", "#aaffee",
                "#cc44cc", "#00cc55", "#0000aa", "#eeee77",
                "#dd8855", "#664400", "#ff7777", "#333333",
                "#777777", "#aaff66", "#0088ff", "#bbbbbb" ];

               // Name,  Imm,  ZP,   ZPX,  ZPY,  ABS, ABSX, ABSY, INDX, INDY, SNGL, BRA
var opcodes = [ ["ADC", 0x69, 0x65, 0x75, 0x00, 0x6d, 0x7d, 0x79, 0x61, 0x71, 0x00, 0x00],
                ["AND", 0x29, 0x25, 0x35, 0x00, 0x2d, 0x3d, 0x39, 0x21, 0x31, 0x00, 0x00],
                ["ASL", 0x00, 0x06, 0x16, 0x00, 0x0e, 0x1e, 0x00, 0x00, 0x00, 0x0a, 0x00],
                ["BIT", 0x00, 0x24, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["BPL", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10],
                ["BMI", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x30],
                ["BVC", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x50],
                ["BVS", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x70],
                ["BCC", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x90],
                ["BCS", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xb0],
                ["BNE", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xd0],
                ["BEQ", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0],
                ["CMP", 0xc9, 0xc5, 0xd5, 0x00, 0xcd, 0xdd, 0xd9, 0xc1, 0xd1, 0x00, 0x00],
                ["CPX", 0xe0, 0xe4, 0x00, 0x00, 0xec, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["CPY", 0xc0, 0xc4, 0x00, 0x00, 0xcc, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["DEC", 0x00, 0xc6, 0xd6, 0x00, 0xce, 0xde, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["EOR", 0x49, 0x45, 0x55, 0x00, 0x4d, 0x5d, 0x59, 0x41, 0x51, 0x00, 0x00],
                ["CLC", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x00],
                ["SEC", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x38, 0x00],
                ["CLI", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x58, 0x00],
                ["SEI", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0x00],
                ["CLV", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xb8, 0x00],
                ["CLD", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xd8, 0x00],
                ["SED", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x00],
                ["INC", 0x00, 0xe6, 0xf6, 0x00, 0xee, 0xfe, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["JMP", 0x00, 0x00, 0x00, 0x00, 0x4c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["JSR", 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["LDA", 0xa9, 0xa5, 0xb5, 0x00, 0xad, 0xbd, 0xb9, 0xa1, 0xb1, 0x00, 0x00],
                ["LDX", 0xa2, 0xa6, 0x00, 0xb6, 0xae, 0x00, 0xbe, 0x00, 0x00, 0x00, 0x00],
                ["LDY", 0xa0, 0xa4, 0xb4, 0x00, 0xac, 0xbc, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["LSR", 0x00, 0x46, 0x56, 0x00, 0x4e, 0x5e, 0x00, 0x00, 0x00, 0x4a, 0x00],
                ["NOP", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xea, 0x00],
                ["ORA", 0x09, 0x05, 0x15, 0x00, 0x0d, 0x1d, 0x19, 0x01, 0x11, 0x00, 0x00],
                ["TAX", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xaa, 0x00],
                ["TXA", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x8a, 0x00],
                ["DEX", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xca, 0x00],
                ["INX", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xe8, 0x00],
                ["TAY", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa8, 0x00],
                ["TYA", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x98, 0x00],
                ["DEY", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x88, 0x00],
                ["INY", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc8, 0x00],
                ["ROR", 0x00, 0x66, 0x76, 0x00, 0x6e, 0x7e, 0x00, 0x00, 0x00, 0x6a, 0x00],
                ["ROL", 0x00, 0x26, 0x36, 0x00, 0x2e, 0x3e, 0x00, 0x00, 0x00, 0x2a, 0x00],
                ["RTI", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00],
                ["RTS", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x60, 0x00],
                ["SBC", 0xe9, 0xe5, 0xf5, 0x00, 0xed, 0xfd, 0xf9, 0xe1, 0xf1, 0x00, 0x00],
                ["STA", 0x00, 0x85, 0x95, 0x00, 0x8d, 0x9d, 0x99, 0x81, 0x91, 0x00, 0x00],
                ["TXS", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x9a, 0x00],
                ["TSX", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xba, 0x00],
                ["PHA", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x48, 0x00],
                ["PLA", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x68, 0x00],
                ["PHP", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00],
                ["PLP", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x28, 0x00],
                ["STX", 0x00, 0x86, 0x00, 0x96, 0x8e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["STY", 0x00, 0x84, 0x94, 0x00, 0x8c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
                ["---", 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00] ];

// init
document.getElementById("compileButton").disabled = false;
document.getElementById("runButton").disabled = true;
document.getElementById("hexdumpButton").disabled = true;
document.getElementById("fileSelect").disabled = false;
document.addEventListener("keypress", keyPress, true);

ram.read_hook(0x00fe, 0x00fe, function(addr) {
    return Math.floor(Math.random()*256);
});

ram.write_hook(0x0200, 0x05ff, function(addr, val) {
    display[addr-0x200].background = palette[val & 0x0f];
});

// paint the virtual display
var html = '<table class="screen">';
for(var y=0; y<32; y++) {
    html += "<tr>";
    for(var x=0; x<32; x++) {
        html += '<td class="screen" id="x' + x + 'y' + y + '"></td>';
    }
    html += "</tr>";
}
html += "</table>";
document.getElementById("screen").innerHTML = html;

// reset everything
reset();

//
// keyPress() - store keycode in ZP $ff
//
function keyPress(e) {
    if(typeof window.event != "undefined") {
        e = window.event; // IE fix
    }
    if(e.type == "keypress") {
        var value = e.which;
        ram.write(0xff, value);
    }
}

//
// disableButtons() - disables the Run and Debug buttons when text is altered in the code editor
//
function disableButtons() {
    document.getElementById("runButton").disabled = true;
    document.getElementById("hexdumpButton").disabled = true;
    document.getElementById("fileSelect").disabled = false;
    document.getElementById("compileButton").disabled = false;
    document.getElementById("runButton").value = "Run";
    codeCompiledOK = false;
    codeRunning = false;
    document.getElementById("code").focus();
}

//
// load() - loads a file from server
//
function load(file) {
    reset();
    disableButtons();
    document.getElementById("code").value = "loading, please wait...";
    document.getElementById("compileButton").disabled = true;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if(xhr.readyState == 4) {
            if(xhr.status == 200) {
                document.getElementById("code").value = xhr.responseText;
                document.getElementById("compileButton").disabled = false;
            }
        }
    };
    xhr.open("GET", "examples/" + file);
    xhr.send(null);
}

//
//  reset() - reset CPU and memory
//
function reset() {
    for(var y=0; y<32; y++) {
        for(var x=0; x<32; x++) {
            display[y*32+x] = document.getElementById("x"+x+"y"+y).style;
            display[y*32+x].background = "#000000";
        }
    }

    ram.reset();

    regA = regX = regY = 0;
    defaultCodePC = regPC = 0x600;
    regSP = 0x100;
    regP = 0x20;
    runForever = false;
}

//
// message() - prints text in the message window
//
function message(text) {
    var obj = document.getElementById("messages");
    obj.innerHTML += text + "<br />";
    obj.scrollTop = obj.scrollHeight;
}

//
// compileCode() - compiles code into memory array
//
function compileCode() {
    reset();
    document.getElementById("messages").innerHTML = "";

    var code = document.getElementById("code").value;
    code += "\n\n";
    var lines = code.split("\n");
    codeCompiledOK = true;
    labelIndex = [];
    labelPtr = 0;

    message("indexing labels...");

    defaultCodePC = regPC = 0x600;

    for(var xc=0; xc<lines.length; xc++) {
        if(!indexLabels(lines[xc])) {
            message("<b>label already defined at line "+(xc+1)+":</b> "+lines[xc]);
            return false;
        }
    }

    var str = "found " + labelIndex.length + " label";
    if(labelIndex.length != 1) str += "s";
    message(str);

    defaultCodePC = regPC = 0x600;
    message("compiling code...");

    for(var x=0; x<lines.length; x++) {
        if(!compileLine(lines[x], x)) {
            codeCompiledOK = false;
            break;
        }
    }

    if(codeLen == 0) {
        codeCompiledOK = false;
        message("no code to run");
    }

    if(codeCompiledOK) {
        document.getElementById("runButton").disabled = false;
        document.getElementById("hexdumpButton").disabled = false;
        document.getElementById("compileButton").disabled = true;
        document.getElementById("fileSelect").disabled = false;
        ram.write(defaultCodePC, 0x00);
    } else {
        str = lines[x].replace("<", "&lt;").replace(">", "&gt;");
        message("<b>syntax error - line " + (x+1) + ": " + str + "</b>");
        document.getElementById("runButton").disabled = true;
        document.getElementById("compileButton").disabled = false;
        document.getElementById("fileSelect").disabled = false;
        return;
    }

    updateDisplayFull();
    message("code compiled successfully: " + codeLen + " bytes");
}

//
// indexLabels() - pushes all labels to array
//
function indexLabels(input) {
    // remove comments
    input = input.replace(new RegExp(/^(.*?);.*/), "$1");

    // trim line
    input = input.replace(new RegExp(/^\s+/), "");
    input = input.replace(new RegExp(/\s+$/), "");

    // figure out how many bytes this instuction takes
    var thisPC = defaultCodePC;

    codeLen = 0;
    compileLine(input);
    regPC += codeLen;

    // find command or label
    if(input.match(new RegExp(/^\w+:/))) {
        var label = input.replace(new RegExp(/(^\w+):.*$/), "$1");
        return pushLabel(label + "|" + thisPC);
    }

    return true;
}

//
// pushLabel() - push label to array
//   returns false if label already exists
//
function pushLabel(name) {
    if(findLabel(name)) return false;
    labelIndex[labelPtr++] = name + "|";
    return true;
}

//
// findLabel() - returns true if label exists
//
function findLabel(name) {
    for(var i=0; i<labelIndex.length; i++) {
        var nameAndAddr = labelIndex[i].split("|");
        if(name == nameAndAddr[0]) {
            return true;
        }
    }
    return false;
}

//
// setLabelPC() - associates label with address
//
function setLabelPC(name, addr) {
    for(var i=0; i<labelIndex.length; i++) {
        var nameAndAddr = labelIndex[i].split("|");
        if(name == nameAndAddr[0]) {
            labelIndex[i] = name + "|" + addr;
            return true;
        }
    }
    return false;
}

//
// getLabelPC() - get address associated with label
//
function getLabelPC(name) {
    for(var i=0; i<labelIndex.length; i++) {
        var nameAndAddr = labelIndex[i].split("|");
        if(name == nameAndAddr[0]) {
            return (nameAndAddr[1]);
        }
    }
    return -1;
}

//
// compileLine() - compiles one line of code
//   returns true if it compiled successfully
//
function compileLine(input, lineno) {
    // remove comments
    input = input.replace(new RegExp(/^(.*?);.*/), "$1");

    // trim line
    input = input.replace(new RegExp(/^\s+/), "");
    input = input.replace(new RegExp(/\s+$/), "");

    // find command or label
    var command = "";
    if(input.match(new RegExp(/^\w+:/))) {
// TODO: is label not used?
//        label = input.replace(new RegExp(/(^\w+):.*$/), "$1");
        if(input.match(new RegExp(/^\w+:[\s]*\w+.*$/))) {
            input = input.replace(new RegExp(/^\w+:[\s]*(.*)$/), "$1");
            command = input.replace(new RegExp(/^(\w+).*$/), "$1");
        } else {
            command = "";
        }
    } else {
        command = input.replace(new RegExp(/^(\w+).*$/), "$1");
    }

    // blank line?
    if(command == "")
        return true;

    command = command.toUpperCase();

    var param = "";
    if(input.match(/^\*[\s]*=[\s]*[\$]?[0-9a-f]*$/)) {
        // equ spotted
        var addr = -1;
        param = input.replace(new RegExp(/^[\s]*\*[\s]*=[\s]*/), "");
        if(param[0] == "$") {
            param = param.replace(new RegExp(/^\$/), "");
            addr = parseInt(param, 16);
        } else {
            addr = parseInt(param, 10);
        }
        if((addr < 0) || (addr > 0xffff)) {
            message("unable to relocate code outside 64k memory");
            return false;
        }
        defaultCodePC = addr;
        return true;
    }

    if(input.match(/^\w+\s+.*?$/)) {
        param = input.replace(new RegExp(/^\w+\s+(.*?)/), "$1");
    } else {
        if(input.match(/^\w+$/)) {
            param = "";
        } else {
            return false;
        }
    }

    param = param.replace(/[ ]/g, "");

    if(command == "DCB")
        return DCB(param);

    for(var o=0; o<opcodes.length; o++) {
        if(opcodes[o][0] == command) {
            if(checkSingle(param, opcodes[o][10])) return true;
            if(checkImmediate(param, opcodes[o][1])) return true;
            if(checkZeroPage(param, opcodes[o][2])) return true;
            if(checkZeroPageX(param, opcodes[o][3])) return true;
            if(checkZeroPageY(param, opcodes[o][4])) return true;
            if(checkAbsoluteX(param, opcodes[o][6])) return true;
            if(checkAbsoluteY(param, opcodes[o][7])) return true;
            if(checkIndirectX(param, opcodes[o][8])) return true;
            if(checkIndirectY(param, opcodes[o][9])) return true;
            if(checkAbsolute(param, opcodes[o][5])) return true;
            if(checkBranch(param, opcodes[o][11])) return true;
        }
    }

    return false; // unknown opcode
}

/*****************************************************************************
 ****************************************************************************/

function DCB(param) {
    var values = param.split(",");
    if(values.length == 0) return false;
    for(var v=0; v<values.length; v++) {
        var str = values[v];
        if(str != undefined && str != null && str.length > 0) {
            var ch = str.substring(0, 1);
            var number = 0;
            if(ch == "$") {
                number = parseInt(str.replace(/^\$/, ""), 16);
                pushByte(number);
            } else if(ch >= "0" && ch <= "9") {
                number = parseInt(str, 10);
                pushByte(number);
            } else {
                return false;
            }
        }
    }
    return true;
}

//
// checkBranch() - commom branch function for all branches (BCC, BCS, BEQ, BNE..)
//
function checkBranch(param, opcode) {
    if(opcode == 0x00) return false;

    var addr = -1;
    if(param.match(/\w+/))
        addr = getLabelPC(param);
    if(addr == -1) { pushWord(0x00); return false; }
    pushByte(opcode);
    if(addr < (defaultCodePC-0x600)) {    // Backwards?
        pushByte((0xff - ((defaultCodePC-0x600)-addr)) & 0xff);
        return true;
    }
    pushByte((addr-(defaultCodePC-0x600)-1) & 0xff);
    return true;
}

//
// checkImmediate() - check if param is immediate and push value
//
function checkImmediate(param, opcode) {
    if(opcode == 0x00) return false;

    if(param.match(new RegExp(/^#\$[0-9a-f]{1,2}$/i))) {
        pushByte(opcode);
        let value = parseInt(param.replace(/^#\$/, ""), 16);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    if(param.match(new RegExp(/^#[0-9]{1,3}$/i))) {
        pushByte(opcode);
        let value = parseInt(param.replace(/^#/, ""), 10);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    // label lo/hi
    if(param.match(new RegExp(/^#[<>]\w+$/))) {
        let label = param.replace(new RegExp(/^#[<>](\w+)$/), "$1");
        let hilo = param.replace(new RegExp(/^#([<>]).*$/), "$1");
        pushByte(opcode);
        if(findLabel(label)) {
            let addr = getLabelPC(label);
            switch(hilo) {
                case ">":
                    pushByte((addr >> 8) & 0xff);
                    return true;
                case "<":
                    pushByte(addr & 0xff);
                    return true;
                default:
                    return false;
            }
        } else {
            pushByte(0x00);
            return true;
        }
    }
    return false;
}

//
// checkIndZP() - check indirect ZP
//


//
// checkIndirectX() - check if param is indirect X and push value
//
function checkIndirectX(param, opcode) {
    if(opcode == 0x00) return false;
    if(param.match(/^\(\$[0-9a-f]{1,2},X\)$/i)) {
        pushByte(opcode);
        var value = param.replace(new RegExp(/^\(\$([0-9a-f]{1,2}).*$/i), "$1");
        if(value < 0 || value > 255) return false;
        pushByte(parseInt(value, 16));
        return true;
    }
    return false;
}

//
// checkIndirectY() - check if param is indirect Y and push value
//
function checkIndirectY(param, opcode) {
    if(opcode == 0x00) return false;
    if(param.match(/^\(\$[0-9a-f]{1,2}\),Y$/i)) {
        pushByte(opcode);
        var value = param.replace(new RegExp(/^\([\$]([0-9a-f]{1,2}).*$/i), "$1");
        if(value < 0 || value > 255) return false;
        pushByte(parseInt(value, 16));
        return true;
    }
    return false;
}

//
//    checkSingle() - single-byte opcodes
//
function checkSingle(param, opcode) {
    if(opcode == 0x00) return false;
    if(param != "") return false;
    pushByte(opcode);
    return true;
}

//
// checkZeroaPage() - check if param is ZP and push value
//
function checkZeroPage(param, opcode) {
    if(opcode == 0x00) return false;

    if(param.match(/^\$[0-9a-f]{1,2}$/i)) {
        pushByte(opcode);
        let value = parseInt(param.replace(/^\$/, ""), 16);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    if(param.match(/^[0-9]{1,3}$/i)) {
        pushByte(opcode);
        let value = parseInt(param, 10);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    return false;
}

//
// checkAbsoluteX() - check if param is ABSX and push value
//
function checkAbsoluteX(param, opcode) {
    if(opcode == 0x00) return false;
    if(param.match(/^\$[0-9a-f]{3,4},X$/i)) {
        pushByte(opcode);
        var number = param.replace(new RegExp(/^\$([0-9a-f]*),X/i), "$1");
        var value = parseInt(number, 16);
        if(value < 0 || value > 0xffff) return false;
        pushWord(value);
        return true;
    }

    if(param.match(/^\w+,X$/i)) {
        param = param.replace(new RegExp(/,X$/i), "");
        pushByte(opcode);
        if(findLabel(param)) {
            var addr = getLabelPC(param);
            if(addr < 0 || addr > 0xffff) return false;
            pushWord(addr);
            return true;
        } else {
            pushWord(0x1234);
            return true;
        }
    }

    return false;
}

//
// checkAbsoluteY() - check if param is ABSY and push value
//
function checkAbsoluteY(param, opcode) {
    if(opcode == 0x00) return false;
    if(param.match(/^\$[0-9a-f]{3,4},Y$/i)) {
        pushByte(opcode);
        var number = param.replace(new RegExp(/^\$([0-9a-f]*),Y/i), "$1");
        var value = parseInt(number, 16);
        if(value < 0 || value > 0xffff) return false;
        pushWord(value);
        return true;
    }

    // it could be a label too...
    if(param.match(/^\w+,Y$/i)) {
        param = param.replace(new RegExp(/,Y$/i), "");
        pushByte(opcode);
        if(findLabel(param)) {
            var addr = getLabelPC(param);
            if(addr < 0 || addr > 0xffff) return false;
            pushWord(addr);
            return true;
        } else {
            pushWord(0x1234);
            return true;
        }
    }
    return false;
}

//
// checkZeroPageX() - check if param is ZPX and push value
//
function checkZeroPageX(param, opcode) {
    if(opcode == 0x00) return false;

    if(param.match(/^\$[0-9a-f]{1,2},X/i)) {
        pushByte(opcode);
        let number = param.replace(new RegExp(/^\$([0-9a-f]{1,2}),X/i), "$1");
        let value = parseInt(number, 16);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    if(param.match(/^[0-9]{1,3},X/i)) {
        pushByte(opcode);
        let number = param.replace(new RegExp(/^([0-9]{1,3}),X/i), "$1");
        let value = parseInt(number, 10);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    return false;
}

//
// checkZeroPageY() - check if param is ZPY and push value
//
function checkZeroPageY(param, opcode) {
    if(opcode == 0x00) return false;
    if(param.match(/^\$[0-9a-f]{1,2},Y/i)) {
        pushByte(opcode);
        let number = param.replace(new RegExp(/^\$([0-9a-f]{1,2}),Y/i), "$1");
        let value = parseInt(number, 16);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    if(param.match(/^[0-9]{1,3},Y/i)) {
        pushByte(opcode);
        let number = param.replace(new RegExp(/^([0-9]{1,3}),Y/i), "$1");
        let value = parseInt(number, 10);
        if(value < 0 || value > 255) return false;
        pushByte(value);
        return true;
    }
    return false;
}

//
// checkAbsolute() - check if param is ABS and push value
//
function checkAbsolute(param, opcode) {
    if(opcode == 0x00) return false;
    pushByte(opcode);
    if(param.match(/^\$[0-9a-f]{3,4}$/i)) {
        let value = parseInt(param.replace(/^\$/, ""), 16);
        if(value < 0 || value > 0xffff) return false;
        pushWord(value);
        return true;
    }
    // it could be a label too...
    if(param.match(/^\w+$/)) {
        if(findLabel(param)) {
            let addr = (getLabelPC(param));
            if(addr < 0 || addr > 0xffff) return false;
            pushWord(addr);
            return true;
        } else {
            pushWord(0x1234);
            return true;
        }
    }
    return false;
}

/*****************************************************************************
 ****************************************************************************/

//
// stackPush() - push byte to stack
//
function stackPush(value) {
    if(regSP >= 0) {
        regSP--;
        ram.write((regSP & 0xff) + 0x100, value);
    } else {
        message("Stack full: " + regSP);
        codeRunning = false;
    }
}

/*****************************************************************************
 ****************************************************************************/

//
// stackPop() - pop byte from stack
//
function stackPop() {
    if(regSP < 0x100) {
        var value = ram.read(regSP + 0x100);
        regSP++;
        return value;
    } else {
        message("Stack empty");
        codeRunning = false;
        return 0;
    }
}

//
// pushByte() - push byte into memory
//
function pushByte(value) {
    ram.write(defaultCodePC, value);
    defaultCodePC++;
    codeLen++;
}

//
// pushWord() - push a word using pushByte twice
//
function pushWord(value) {
    pushByte(value);
    pushByte(value >> 8);
}

//
// popByte() - pops a byte
//
function popByte() {
    return ram.read(regPC++);
}

//
// popWord() - pops a word using popByte() twice
//
function popWord() {
    return popByte() | (popByte() << 8);
}

function addr2hex(addr) {
    return (addr & 0xffff).toString(16);
}

//
// hexDump() - dump binary as hex to new window
//
function hexDump() {
    var w = window.open('', 'hexdump', 'width=500,height=300,resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no,status=no');

    var html = "<html><head>";
    html += "<link href='style.css' rel='stylesheet' type='text/css' />";
    html += "<title>hexdump</title></head><body>";
    html += "<code>";
    var x;
    for(x=0; x<codeLen; x++) {
        if((x&15) == 0) {
            html += "<br/> ";
            var n = (0x600+x);
            html += ((n >> 8) & 0xff).toString(16);
            html += (n & 0xff).toString(16);
            html += ": ";
        }
        html += ram.read(0x600 + x).toString(16);
        if(x & 1) html += " ";
    }
    if((x & 1)) html += "-- [END]";
    html += "</code></body></html>";
    w.document.write(html);
    w.document.close();
}

//
// runBinary() - executes the compiled code
//
function runBinary() {
    if(codeRunning) {
        codeRunning = false;
        document.getElementById("runButton").value = "Run";
        document.getElementById("hexdumpButton").disabled = false;
        document.getElementById("fileSelect").disabled = false;
        clearInterval(myInterval);
    } else {
        //reset();
        document.getElementById("runButton").value = "Stop";
        document.getElementById("fileSelect").disabled = true;
        document.getElementById("hexdumpButton").disabled = true;
        codeRunning = true;
        myInterval = setInterval("multiexecute()", 1);
        //execute();
    }
}

function jumpBranch(offset) {
    if(offset > 0x7f)
        regPC = (regPC - (0x100 - offset));
    else
        regPC = (regPC + offset);
}

function doCompare(reg, val) {
    if((reg + val) > 0xff)
        regP |= 1;
    else
        regP &= 0xfe;
    val = (reg - val);

//    if(reg+0x100-val > 0xff) regP |= 1; else regP &= 0xfe;
//    val = reg+0x100-val;

    if(val)
        regP &= 0xfd;
    else
        regP |= 0x02;

    if(val & 0x80)
        regP |= 0x80;
    else
        regP &= 0x7f;
}

function testSBC(value) {
    var vflag, w;

    if((regA ^ value) & 0x80)
        vflag = 1;
    else
        vflag = 0;

    if(regP & 8) {
        var tmp = 0xf + (regA & 0xf) - (value & 0xf) + (regP & 0x01);
        if(tmp < 0x10) {
            w = 0;
            tmp -= 6;
        } else {
            w = 0x10;
            tmp -= 0x10;
        }
        w += 0xf0 + (regA & 0xf0) - (value & 0xf0);
        if(w < 0x100) {
            regP &= 0xfe;
            if((regP & 0xbf) && w < 0x80) regP &= 0xbf;
            w -= 0x60;
        } else {
            regP |= 1;
            if((regP & 0xbf) && w >= 0x180) regP &= 0xbf;
        }
        w += tmp;
    } else {
        w = 0xff + regA - value + (regP & 0x01);
        if(w < 0x100) {
            regP &= 0xfe;
            if((regP & 0xbf) && w < 0x80) regP &= 0xbf;
        } else {
            regP |= 1;
            if((regP & 0xbf) && w >= 0x180) regP &= 0xbf;
        }
    }

    regA = w & 0xff;
    if(regA) regP &= 0xfd; else regP |= 0x02;
    if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
}

function testADC(value) {
    var tmp;

    if((regA ^ value) & 0x80) {
        regP &= 0xbf;
    } else {
        regP |= 0x40;
    }

    if(regP & 8) {
        tmp = (regA & 0xf) + (value & 0xf) + (regP & 0x01);
        if(tmp >= 10) {
            tmp = 0x10 | ((tmp + 6) & 0x0f);
        }
        tmp += (regA & 0xf0) + (value & 0xf0);
        if(tmp >= 160) {
            regP |= 1;
            if((regP & 0xbf) && tmp >= 0x180) regP &= 0xbf;
            tmp += 0x60;
        } else {
            regP &= 0xfe;
            if((regP&0xbf) && tmp < 0x80) regP &= 0xbf;
        }
    } else {
        tmp = regA + value + (regP & 0x01);
        if(tmp >= 0x100) {
            regP |= 1;
            if((regP&0xbf) && tmp >= 0x180) regP &= 0xbf;
        } else {
            regP &= 0xfe;
            if((regP & 0xbf) && tmp < 0x80) regP &= 0xbf;
        }
    }

    regA = tmp & 0xff;
    if(regA) regP &= 0xfd; else regP |= 0x02;
    if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
}

function multiexecute() {
    for(var i=0; i<128; i++)
        execute();
}

//
// execute() - executes one instruction
//             this is the main part of the CPU emulator
//
function execute() {
    if(!codeRunning) return;

    var addr, offset, value, sf, zp;

    var opcode = popByte();
//    message("PC=" + addr2hex(regPC-1) + " opcode=" + opcode + " X="+regX + " Y=" + regY + " A=" + regA);
    switch(opcode) {
        case 0x00:                                                        // BRK implied
            codeRunning = false;
            break;
        case 0x01:                                                        // ORA INDX
            addr = popByte() + regX;
            value = ram.read_word(addr);
            regA |= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x05:                                                        // ORA ZP
            zp = popByte();
            regA |= ram.read(zp);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x06:                                                        // ASL ZP
            zp = popByte();
            value = ram.read(zp);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            ram.write(zp, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x08:                                                        // PHP
            stackPush(regP);
            break;
        case 0x09:                                                        // ORA IMM
            regA |= popByte();
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x0a:                                                        // ASL IMPL
            regP = (regP & 0xfe) | ((regA>>7)&1);
            regA = regA<<1;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x0d:                                                        // ORA ABS
            regA |= ram.read(popWord());
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x0e:                                                        // ASL ABS
            addr = popWord();
            value = ram.read(addr);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 2;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x10:                                                        // BPL
            offset = popByte();
            if((regP & 0x80) == 0) jumpBranch(offset);
            break;
        case 0x11:                                                        // ORA INDY
            zp = popByte();
            value = ram.read_word(zp) + regY;
            regA |= ram.read(value);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x15:                                                        // ORA ZPX
            addr = (popByte() + regX) & 0xff;
            regA |= ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x16:                                                        // ASL ZPX
            addr = (popByte() + regX) & 0xff;
            value = ram.read(addr);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x18:                                                        // CLC
            regP &= 0xfe;
            break;
        case 0x19:                                                        // ORA ABSY
            addr = popWord() + regY;
            regA |= ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x1d:                                                        // ORA ABSX
            addr = popWord() + regX;
            regA |= ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x1e:                                                        // ASL ABSX
            addr = popWord() + regX;
            value = ram.read(addr);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x20:                                                        // JSR ABS
            addr = popWord();
            var currAddr = regPC-1;
            stackPush(((currAddr >> 8) & 0xff));
            stackPush((currAddr & 0xff));
            regPC = addr;
            break;
        case 0x21:                                                        // AND INDX
            addr = (popByte() + regX)&0xff;
            value = ram.read_word(addr);
            regA &= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x24:                                                        // BIT ZP
            zp = popByte();
            value = ram.read(zp);
            if(value & regA) regP &= 0xfd; else regP |= 0x02;
            regP = (regP & 0x3f) | (value & 0xc0);
            break;
        case 0x25:                                                        // AND ZP
            zp = popByte();
            regA &= ram.read(zp);
            if(regA) regP &= 0xfd; else regP |= 2;
            if(regA & 0x80) regP &= 0x80; else regP &= 0x7f;
            break;
        case 0x26:                                                        // ROL ZP
            sf = (regP & 1);
            addr = popByte();
            value = ram.read(addr);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            value |= sf;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x28:                                                        // PLP
            regP = stackPop() | 0x20;
            break;
        case 0x29:                                                        // AND IMM
            regA &= popByte();
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x2a:                                                        // ROL A
            sf = (regP&1);
            regP = (regP&0xfe) | ((regA>>7)&1);
            regA = regA << 1;
            regA |= sf;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x2c:                                                        // BIT ABS
            value = ram.read(popWord());
            if(value & regA) regP &= 0xfd; else regP |= 0x02;
            regP = (regP & 0x3f) | (value & 0xc0);
            break;
        case 0x2d:                                                        // AND ABS
            value = ram.read(popWord());
            regA &= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x2e:                                                        // ROL ABS
            sf = regP & 1;
            addr = popWord();
            value = ram.read(addr);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            value |= sf;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x30:                                                        // BMI
            offset = popByte();
            if(regP & 0x80) jumpBranch(offset);
            break;
        case 0x31:                                                        // AND INDY
            zp = popByte();
            value = ram.read_word(zp) + regY;
            regA &= ram.read(value);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x35:                                                        // AND INDX
            zp = popByte();
            value = ram.read_word(zp) + regX;
            regA &= ram.read(value);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x36:                                                        // ROL ZPX
            sf = regP & 1;
            addr = (popByte() + regX) & 0xff;
            value = ram.read(addr);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            value |= sf;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x38:                                                        // SEC
            regP |= 1;
            break;
        case 0x39:                                                        // AND ABSY
            addr = popWord() + regY;
            value = ram.read(addr);
            regA &= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x3d:                                                        // AND ABSX
            addr = popWord() + regX;
            value = ram.read(addr);
            regA &= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x3e:                                                        // ROL ABSX
            sf = regP&1;
            addr = popWord() + regX;
            value = ram.read(addr);
            regP = (regP & 0xfe) | ((value>>7)&1);
            value = value << 1;
            value |= sf;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x40:                                                        // RTI (unsupported, =NOP)
            break;
        case 0x41:                                                        // EOR INDX
            zp = (popByte() + regX)&0xff;
            value = ram.read_word(zp);
            regA ^= ram.read(value);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x45:                                                        // EOR ZPX
            addr = (popByte() + regX) & 0xff;
            value = ram.read(addr);
            regA ^= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x46:                                                        // LSR ZP
            addr = popByte() & 0xff;
            value = ram.read(addr);
            regP = (regP & 0xfe) | (value&1);
            value = value >> 1;
            ram.write(addr, value);
            if(value != 0) regP &= 0xfd; else regP |= 2;
            if((value&0x80) == 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x48:                                                        // PHA
            stackPush(regA);
            break;
        case 0x49:                                                        // EOR IMM
            regA ^= popByte();
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x4a:                                                        // LSR
            regP = (regP&0xfe) | (regA&1);
            regA = regA >> 1;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x4c:                                                        // JMP abs
            regPC = popWord();
            break;
        case 0x4d:                                                        // EOR abs
            addr = popWord();
            value = ram.read(addr);
            regA ^= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x4e:                                                     // LSR abs
            addr = popWord();
            value = ram.read(addr);
            regP = (regP&0xfe)|(value&1);
            value = value >> 1;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x50:                                                     // BVC (on overflow clear)
            offset = popByte();
            if((regP & 0x40) == 0) jumpBranch(offset);
            break;
        case 0x51:                                                     // EOR INDY
            zp = popByte();
            value = ram.read_word(zp) + regY;
            regA ^= ram.read(value);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x55:                                                     // EOR ZPX
            addr = (popByte() + regX) & 0xff;
            regA ^= ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x56:                                                     // LSR ZPX
            addr = (popByte() + regX) & 0xff;
            value = ram.read(addr);
            regP = (regP&0xfe) | (value&1);
            value = value >> 1;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x58:                                                     // CLI (does nothing)
            break;
        case 0x59:                                                     // EOR ABSY
            addr = popWord() + regY;
            value = ram.read(addr);
            regA ^= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x5d:                                                     // EOR ABSX
            addr = popWord() + regX;
            value = ram.read(addr);
            regA ^= value;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x5e:                                                     // LSR ABSX
            addr = popWord() + regX;
            value = ram.read(addr);
            regP = (regP&0xfe) | (value&1);
            value = value >> 1;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x60:                                                     // RTS
            regPC = (stackPop()+1) | (stackPop()<<8);
            break;
        case 0x61:                                                     // ADC INDX
            zp = (popByte() + regX)&0xff;
            addr = ram.read_word(zp);
            value = ram.read(addr);
            testADC(value);
            break;
        case 0x65:                                                     // ADC ZP
            addr = popByte();
            value = ram.read(addr);
            testADC(value);
            break;
        case 0x66:                                                     // ROR ZP
            sf = regP&1;
            addr = popByte();
            value = ram.read(addr);
            regP = (regP&0xfe)|(value&1);
            value = value >> 1;
            if(sf) value |= 0x80;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x68:                                                     // PLA
            regA = stackPop();
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x69:                                                     // ADC IMM
            value = popByte();
            testADC(value);
            break;
        case 0x6a:                                                     // ROR A
            sf = regP&1;
            regP = (regP&0xfe) | (regA&1);
            regA = regA >> 1;
            if(sf) regA |= 0x80;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x6c: // JMP INDIR
//            regPC = memReadByte(popByte()) + (memReadByte(popByte())<<8);
            break;
        case 0x6d:                                                     // ADC ABS
            addr = popWord();
            value = ram.read(addr);
            testADC(value);
            break;
        case 0x6e:                                                     // ROR ABS
            sf = regP&1;
            addr = popWord();
            value = ram.read(addr);
            regP = (regP&0xfe)|(value&1);
            value = value >> 1;
            if(sf) value |= 0x80;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x70:                                                     // BVS (branch on overflow set)
            offset = popByte();
            if(regP & 0x40) jumpBranch(offset);
            break;
        case 0x71:                                                     // ADC INY
            zp = popByte();
            addr = ram.read_word(zp);
            value = ram.read(addr + regY);
            testADC(value);
            break;
        case 0x75:                                                     // ADC ZPX
            addr = (popByte() + regX) & 0xff;
            value = ram.read(addr);
            regP = (regP&0xfe) | (value&1);
            testADC(value);
            break;
        case 0x76:                                                     // ROR ZPX
            sf = (regP&1);
            addr = (popByte() + regX) & 0xff;
            value = ram.read(addr);
            regP = (regP&0xfe) | (value&1);
            value = value >> 1;
            if(sf) value |= 0x80;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x78:                                                     // SEI (does nothing)
            break;
        case 0x79:                                                     // ADC ABSY
            addr = popWord();
            value = ram.read(addr + regY);
            testADC(value);
            break;
        case 0x7d:                                                     // ADC ABSX
            addr = popWord();
            value = ram.read(addr + regX);
            testADC(value);
            break;
        case 0x7e:                                                     // ROR ABSX
            sf = regP&1;
            addr = popWord() + regX;
            value = ram.read(addr);
            regP = (regP&0xfe) | (value&1);
            value = value >> 1;
            if(value) value |= 0x80;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x81:                                                     // STA INDX
            zp = (popByte()+regX)&0xff;
            addr = ram.read_word(zp);
            ram.write(addr, regA);
            break;
        case 0x84:                                                     // STY ZP
            ram.write(popByte(), regY);
            break;
        case 0x85:                                                     // STA ZP
            ram.write(popByte(), regA);
            break;
        case 0x86:                                                     // STX ZP
            ram.write(popByte(), regX);
            break;
        case 0x88:                                                     // DEY (1 byte)
            regY = (regY-1) & 0xff;
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x8a:                                                     // TXA (1 byte);
            regA = regX & 0xff;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x8c:                                                     // STY abs
            ram.write(popWord(), regY);
            break;
        case 0x8d:                                                     // STA ABS (3 bytes)
            ram.write(popWord(), regA);
            break;
        case 0x8e:                                                     // STX abs
            ram.write(popWord(), regX);
            break;
        case 0x90:                                                     // BCC (branch on carry clear)
            offset = popByte();
            if((regP & 1) == 0) jumpBranch(offset);
            break;
        case 0x91:                                                     // STA INDY
            zp = popByte();
            addr = ram.read_word(zp) + regY;
            ram.write(addr, regA);
            break;
        case 0x94:                                                     // STY ZPX
            ram.write(popByte() + regX, regY);
            break;
        case 0x95:                                                     // STA ZPX
            ram.write(popByte() + regX, regA);
            break;
        case 0x96:                                                     // STX ZPY
            ram.write(popByte() + regY, regX);
            break;
        case 0x98:                                                     // TYA
            regA = regY & 0xff;
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0x99:                                                     // STA ABSY
            ram.write(popWord() + regY, regA);
            break;
        case 0x9a:                                                     // TXS
            regSP = regX & 0xff;
            break;
        case 0x9d:                                                     // STA ABSX
            addr = popWord();
            ram.write(addr + regX, regA);
            break;
        case 0xa0:                                                     // LDY IMM
            regY = popByte();
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xa1:                                                     // LDA INDX
            zp = (popByte()+regX)&0xff;
            addr = ram.read_word(zp);
            regA = ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xa2:                                                     // LDX IMM
            regX = popByte();
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xa4:                                                     // LDY ZP
            regY = ram.read(popByte());
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xa5:                                                     // LDA ZP
            regA = ram.read(popByte());
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xa6:                                                    // LDX ZP
            regX = ram.read(popByte());
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xa8:                                                    // TAY
            regY = regA & 0xff;
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xa9:                                                    // LDA IMM
            regA = popByte();
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xaa:                                                    // TAX
            regX = regA & 0xff;
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xac:                                                    // LDY ABS
            regY = ram.read(popWord());
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xad:                                                    // LDA ABS
            regA = ram.read(popWord());
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xae:                                                    // LDX ABS
            regX = ram.read(popWord());
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xb0:                                                    // BCS
            offset = popByte();
            if(regP & 1) jumpBranch(offset);
            break;
        case 0xb1:                                                    // LDA INDY
            zp = popByte();
            addr = ram.read_word(zp) + regY;
            regA = ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break; 
        case 0xb4:                                                    // LDY ZPX
            regY = ram.read(popByte() + regX);
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xb5:                                                    // LDA ZPX
            regA = ram.read(popByte() + regX);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xb6:                                                    // LDX ZPY
            regX = ram.read(popByte() + regY);
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xb8:                                                    // CLV
            regP &= 0xbf;
            break;
        case 0xb9:                                                    // LDA ABSY
            addr = popWord() + regY;
            regA = ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xba:                                                    // TSX
            regX = regSP & 0xff;
            break;
        case 0xbc:                                                    // LDY ABSX
            addr = popWord() + regX;
            regY = ram.read(addr);
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xbd:                                                    // LDA ABSX
            addr = popWord() + regX;
            regA = ram.read(addr);
            if(regA) regP &= 0xfd; else regP |= 0x02;
            if(regA & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xbe:                                                    // LDX ABSY
            addr = popWord() + regY;
            regX = ram.read(addr);
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xc0:                                                    // CPY IMM
            value = popByte();
            if((regY+value) > 0xff) regP |= 1; else regP &= 0xfe;
            // TODO: is ov not used?
            //ov = value;
            value = (regY-value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xc1:                                                    // CMP INDY
            zp = popByte();
            addr = ram.read_word(zp) + regY;
            value = ram.read(addr);
            doCompare(regA, value);
            break;
        case 0xc4:                                                    // CPY ZP
            value = ram.read(popByte());
            doCompare(regY, value);
            break;
        case 0xc5:                                                    // CMP ZP
            value = ram.read(popByte());
            doCompare(regA, value);
            break;
        case 0xc6:                                                    // DEC ZP
            zp = popByte();
            value = ram.read(zp);
            --value;
            ram.write(zp, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xc8:                                                    // INY
            regY = (regY + 1) & 0xff;
            if(regY) regP &= 0xfd; else regP |= 0x02;
            if(regY & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xc9:                                                    // CMP IMM
            value = popByte();
            doCompare(regA, value);
            break;
        case 0xca:                                                    // DEX
            regX = (regX-1) & 0xff;
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xcc:                                                    // CPY ABS
            value = ram.read(popWord());
            doCompare(regY, value);
            break;
        case 0xcd:                                                    // CMP ABS
            value = ram.read(popWord());
            doCompare(regA, value);
            break;
        case 0xce:                                                    // DEC ABS
            addr = popWord();
            value = ram.read(addr);
            --value;
            value = value&0xff;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xd0:                                                    // BNE
            offset = popByte();
//            if((regP&2)==0) { oldPC = regPC; jumpBranch(offset); message("Jumping from " + addr2hex(oldPC) + " to " + addr2hex(regPC)); } else { message("NOT jumping!"); }
            if((regP&2)==0) jumpBranch(offset);
            break;
        case 0xd1:                                                    // CMP INDY
            zp = popByte();
            addr = ram.read_word(zp) + regY;
            value = ram.read(addr);
            doCompare(regA, value);
            break;
        case 0xd5:                                                    // CMP ZPX
            value = ram.read(popByte() + regX);
            doCompare(regA, value);
            break;
        case 0xd6:                                                    // DEC ZPX
            addr = popByte() + regX;
            value = ram.read(addr);
            --value;
            value = value&0xff;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xd8:                                                    // CLD (CLear Decimal)
            regP &= 0xf7;
            break;
        case 0xd9:                                                    // CMP ABSY
            addr = popWord() + regY;
            value = ram.read(addr);
            doCompare(regA, value);
            break;
        case 0xdd:                                                    // CMP ABSX
            addr = popWord() + regX;
            value = ram.read(addr);
            doCompare(regA, value);
            break;
        case 0xde:                                                    // DEC ABSX
            addr = popWord() + regX;
            value = ram.read(addr);
            --value;
            value = value&0xff;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xe0:                                                    // CPX IMM
            value = popByte();
            doCompare(regX, value);
            break;
        case 0xe1:                                                    // SBC INDX
            zp = (popByte()+regX)&0xff;
            addr = ram.read_word(zp);
            value = ram.read(addr);
            testSBC(value);
            break;
        case 0xe4:                                                    // CPX ZP
            value = ram.read(popByte());
            doCompare(regX, value);
            break;
        case 0xe5:                                                    // SBC ZP
            addr = popByte();
            value = ram.read(addr);
            testSBC(value);
            break;
        case 0xe6:                                                    // INC ZP
            zp = popByte();
            value = ram.read(zp);
            ++value;
            value = (value)&0xff;
            ram.write(zp, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xe8:                                                    // INX
            regX = (regX + 1) & 0xff;
            if(regX) regP &= 0xfd; else regP |= 0x02;
            if(regX & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xe9:                                                 // SBC IMM
            value = popByte();
            testSBC(value);
            break;
        case 0xea:                                                 // NOP
            break;
        case 0xec:                                                 // CPX ABS
            value = ram.read(popWord());
            doCompare(regX, value);
            break;
        case 0xed:                                                 // SBC ABS
            addr = popWord();
            value = ram.read(addr);
            testSBC(value);
            break;
        case 0xee:                                                 // INC ABS
            addr = popWord();
            value = ram.read(addr);
            ++value;
            value = (value)&0xff;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xf0:                                                 // BEQ
            offset = popByte();
            if(regP&2) jumpBranch(offset);
            break;
        case 0xf1:                                                 // SBC INDY
            zp = popByte();
            addr = ram.read_word(zp);
            value = ram.read(addr + regY);
            testSBC(value);
            break;
        case 0xf5:                                                 // SBC ZPX
            addr = (popByte() + regX)&0xff;
            value = ram.read(addr);
            regP = (regP&0xfe)|(value&1);
            testSBC(value);
            break;
        case 0xf6:                                                 // INC ZPX
            addr = popByte() + regX;
            value = ram.read(addr);
            ++value;
            value=value&0xff;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        case 0xf8:                                                 // SED
            regP |= 8;
            break;
     case 0xf9:                                                    // SBC ABSY
            addr = popWord();
            value = ram.read(addr + regY);
            testSBC(value);
            break;
        case 0xfd:                                                 // SBC ABSX
            addr = popWord();
            value = ram.read(addr + regX);
            testSBC(value);
            break;
        case 0xfe:                                                 // INC ABSX
            addr = popWord() + regX;
            value = ram.read(addr);
            ++value;
            value=value&0xff;
            ram.write(addr, value);
            if(value) regP &= 0xfd; else regP |= 0x02;
            if(value & 0x80) regP |= 0x80; else regP &= 0x7f;
            break;
        default:
            message("Address $" + addr2hex(regPC) + " - unknown opcode " + opcode);
            codeRunning = false;
            break;
    }

    if((regPC == 0) || (!codeRunning)) {
        clearInterval(myInterval);
        message("Program end at PC=$" + addr2hex(regPC-1));
        codeRunning = false;
        document.getElementById("runButton").value = "Run";
        document.getElementById("fileSelect").disabled = false;
        document.getElementById("hexdumpButton").disabled = false;
//        updateDisplayFull();
    }
}

//
// updatePixelDisplay() - Updates the display at one pixel position
//
function updateDisplayPixel(addr) {
    display[addr-0x200].background = palette[ram.read(addr) & 0x0f];
}

//
// updateDisplayFull() - redraws the entire display according to memory
//   (colors are supposed to be identical with the C64's palette)
//
function updateDisplayFull() {
    for(var y=0; y<32; y++) {
        for(var x=0; x<32; x++) {
            updateDisplayPixel(((y << 5) + x) + 0x200);
        }
    }
}

