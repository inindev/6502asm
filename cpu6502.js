//
//  6502 assembler and emulator in Javascript
//  (C)2006-2009 Stian Soreng - www.6502asm.com
//
//  Released under the GNU General Public License
//  see http://gnu.org/licenses/gpl.html
//
//  refactor by John Clark - https://github.com/inindev/6502asm
//


function CPU6502(ram)
{
    'use strict';

    var ram = ram;

    var interval = null;

    var regPC = 0x600; // program counter
    var regSP = 0x100; // stack pointer
    var regA  = 0x00;  // accumulator
    var regX  = 0x00;  // x register
    var regY  = 0x00;  // y register
    var regS  = 0x20;  // processor status

    // processor status flags
    var psf = {
        carry: 0x01,  // Carry Flag
                      // set if the last operation caused an overflow from bit 7 of the result or an underflow from bit 0
                      // set during arithmetic, comparison and during logical shifts
                      // set using 'Set Carry Flag' (SEC) and cleared with 'Clear Carry Flag' (CLC)

        zero:  0x02,  // Zero Flag
                      // set if the result of the last operation as was zero

        intd:  0x04,  // Interrupt Disable
                      // set using 'Set Interrupt Disable' (SEI) and cleared with 'Clear Interrupt Disable' (CLI)

        decm:  0x08,  // Decimal Mode
                      // when set the processor will obey the rules of Binary Coded Decimal (BCD) arithmetic 
                      // set using 'Set Decimal Flag' (SED) and cleared with 'Clear Decimal Flag' (CLD)

        brkc:  0x10,  // Break Command
                      // set when a BRK instruction has been executed and an interrupt has been generated

        over:  0x40,  // Overflow Flag
                      // set during arithmetic operations if the result has yielded an invalid 2's complement result
                      // determined by looking at the carry between bits 6 and 7 and between bit 7 and the carry flag

        neg:   0x80   // Negative Flag
    };                // set if the result of the last operation had bit 7 set

    // reset the CPU
    function reset() {
        regPC = 0x600;
        regSP = 0x100;
        regA  = 0x00;
        regX  = 0x00;
        regY  = 0x00;
        regS  = 0x20;
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
// TODO: message callback
//          message("Stack full: " + regSP);
          set_running(false);
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
// TODO: message callback
//          message("Stack empty");
          set_running(false);
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
      return (addr & 0xffff).toString(16).padStart(4, '0');
  }

  function is_running() {
      return interval != null;
  }

  //
  // executes the compiled code
  //
  function set_running(do_run) {
      if(do_run == is_running()) {
          return;  // nothing to do
      }

      if(do_run) {
          interval = setInterval(multiexecute, 1);  // run every 1ms
      }
      else {
          clearInterval(interval);
          interval = null;
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
          regS |= 1;
      else
          regS &= 0xfe;
      val = (reg - val);

  //    if(reg+0x100-val > 0xff) regS |= 1; else regS &= 0xfe;
  //    val = reg+0x100-val;

      if(val)
          regS &= 0xfd;
      else
          regS |= 0x02;

      if(val & 0x80)
          regS |= 0x80;
      else
          regS &= 0x7f;
  }

  function testSBC(value) {
      var vflag, w;

      if((regA ^ value) & 0x80)
          vflag = 1;
      else
          vflag = 0;

      if(regS & 8) {
          var tmp = 0xf + (regA & 0xf) - (value & 0xf) + (regS & 0x01);
          if(tmp < 0x10) {
              w = 0;
              tmp -= 6;
          } else {
              w = 0x10;
              tmp -= 0x10;
          }
          w += 0xf0 + (regA & 0xf0) - (value & 0xf0);
          if(w < 0x100) {
              regS &= 0xfe;
              if((regS & 0xbf) && w < 0x80) regS &= 0xbf;
              w -= 0x60;
          } else {
              regS |= 1;
              if((regS & 0xbf) && w >= 0x180) regS &= 0xbf;
          }
          w += tmp;
      } else {
          w = 0xff + regA - value + (regS & 0x01);
          if(w < 0x100) {
              regS &= 0xfe;
              if((regS & 0xbf) && w < 0x80) regS &= 0xbf;
          } else {
              regS |= 1;
              if((regS & 0xbf) && w >= 0x180) regS &= 0xbf;
          }
      }

      regA = w & 0xff;
      if(regA) regS &= 0xfd; else regS |= 0x02;
      if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
  }

  function testADC(value) {
      var tmp;

      if((regA ^ value) & 0x80) {
          regS &= 0xbf;
      } else {
          regS |= 0x40;
      }

      if(regS & 8) {
          tmp = (regA & 0xf) + (value & 0xf) + (regS & 0x01);
          if(tmp >= 10) {
              tmp = 0x10 | ((tmp + 6) & 0x0f);
          }
          tmp += (regA & 0xf0) + (value & 0xf0);
          if(tmp >= 160) {
              regS |= 1;
              if((regS & 0xbf) && tmp >= 0x180) regS &= 0xbf;
              tmp += 0x60;
          } else {
              regS &= 0xfe;
              if((regS&0xbf) && tmp < 0x80) regS &= 0xbf;
          }
      } else {
          tmp = regA + value + (regS & 0x01);
          if(tmp >= 0x100) {
              regS |= 1;
              if((regS&0xbf) && tmp >= 0x180) regS &= 0xbf;
          } else {
              regS &= 0xfe;
              if((regS & 0xbf) && tmp < 0x80) regS &= 0xbf;
          }
      }

      regA = tmp & 0xff;
      if(regA) regS &= 0xfd; else regS |= 0x02;
      if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
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
//      if(!codeRunning) return;

      var addr, offset, value, sf, zp;

      var opcode = popByte();
  //    message("PC=" + addr2hex(regPC-1) + " opcode=" + opcode + " X="+regX + " Y=" + regY + " A=" + regA);
      switch(opcode) {
          case 0x00:                                                        // BRK implied
              set_running(false);
              break;
          case 0x01:                                                        // ORA INDX
              addr = popByte() + regX;
              value = ram.read_word(addr);
              regA |= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x05:                                                        // ORA ZP
              zp = popByte();
              regA |= ram.read(zp);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x06:                                                        // ASL ZP
              zp = popByte();
              value = ram.read(zp);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              ram.write(zp, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x08:                                                        // PHP
              stackPush(regS);
              break;
          case 0x09:                                                        // ORA IMM
              regA |= popByte();
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x0a:                                                        // ASL IMPL
              regS = (regS & 0xfe) | ((regA>>7)&1);
              regA = regA<<1;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x0d:                                                        // ORA ABS
              regA |= ram.read(popWord());
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x0e:                                                        // ASL ABS
              addr = popWord();
              value = ram.read(addr);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 2;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x10:                                                        // BPL
              offset = popByte();
              if((regS & 0x80) == 0) jumpBranch(offset);
              break;
          case 0x11:                                                        // ORA INDY
              zp = popByte();
              value = ram.read_word(zp) + regY;
              regA |= ram.read(value);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x15:                                                        // ORA ZPX
              addr = (popByte() + regX) & 0xff;
              regA |= ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x16:                                                        // ASL ZPX
              addr = (popByte() + regX) & 0xff;
              value = ram.read(addr);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x18:                                                        // CLC
              regS &= 0xfe;
              break;
          case 0x19:                                                        // ORA ABSY
              addr = popWord() + regY;
              regA |= ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x1d:                                                        // ORA ABSX
              addr = popWord() + regX;
              regA |= ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x1e:                                                        // ASL ABSX
              addr = popWord() + regX;
              value = ram.read(addr);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x24:                                                        // BIT ZP
              zp = popByte();
              value = ram.read(zp);
              if(value & regA) regS &= 0xfd; else regS |= 0x02;
              regS = (regS & 0x3f) | (value & 0xc0);
              break;
          case 0x25:                                                        // AND ZP
              zp = popByte();
              regA &= ram.read(zp);
              if(regA) regS &= 0xfd; else regS |= 2;
              if(regA & 0x80) regS &= 0x80; else regS &= 0x7f;
              break;
          case 0x26:                                                        // ROL ZP
              sf = (regS & 1);
              addr = popByte();
              value = ram.read(addr);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              value |= sf;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x28:                                                        // PLP
              regS = stackPop() | 0x20;
              break;
          case 0x29:                                                        // AND IMM
              regA &= popByte();
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x2a:                                                        // ROL A
              sf = (regS&1);
              regS = (regS&0xfe) | ((regA>>7)&1);
              regA = regA << 1;
              regA |= sf;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x2c:                                                        // BIT ABS
              value = ram.read(popWord());
              if(value & regA) regS &= 0xfd; else regS |= 0x02;
              regS = (regS & 0x3f) | (value & 0xc0);
              break;
          case 0x2d:                                                        // AND ABS
              value = ram.read(popWord());
              regA &= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x2e:                                                        // ROL ABS
              sf = regS & 1;
              addr = popWord();
              value = ram.read(addr);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              value |= sf;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x30:                                                        // BMI
              offset = popByte();
              if(regS & 0x80) jumpBranch(offset);
              break;
          case 0x31:                                                        // AND INDY
              zp = popByte();
              value = ram.read_word(zp) + regY;
              regA &= ram.read(value);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x35:                                                        // AND INDX
              zp = popByte();
              value = ram.read_word(zp) + regX;
              regA &= ram.read(value);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x36:                                                        // ROL ZPX
              sf = regS & 1;
              addr = (popByte() + regX) & 0xff;
              value = ram.read(addr);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              value |= sf;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x38:                                                        // SEC
              regS |= 1;
              break;
          case 0x39:                                                        // AND ABSY
              addr = popWord() + regY;
              value = ram.read(addr);
              regA &= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x3d:                                                        // AND ABSX
              addr = popWord() + regX;
              value = ram.read(addr);
              regA &= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x3e:                                                        // ROL ABSX
              sf = regS&1;
              addr = popWord() + regX;
              value = ram.read(addr);
              regS = (regS & 0xfe) | ((value>>7)&1);
              value = value << 1;
              value |= sf;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x40:                                                        // RTI (unsupported, =NOP)
              break;
          case 0x41:                                                        // EOR INDX
              zp = (popByte() + regX)&0xff;
              value = ram.read_word(zp);
              regA ^= ram.read(value);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x45:                                                        // EOR ZPX
              addr = (popByte() + regX) & 0xff;
              value = ram.read(addr);
              regA ^= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x46:                                                        // LSR ZP
              addr = popByte() & 0xff;
              value = ram.read(addr);
              regS = (regS & 0xfe) | (value&1);
              value = value >> 1;
              ram.write(addr, value);
              if(value != 0) regS &= 0xfd; else regS |= 2;
              if((value&0x80) == 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x48:                                                        // PHA
              stackPush(regA);
              break;
          case 0x49:                                                        // EOR IMM
              regA ^= popByte();
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x4a:                                                        // LSR
              regS = (regS&0xfe) | (regA&1);
              regA = regA >> 1;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x4c:                                                        // JMP abs
              regPC = popWord();
              break;
          case 0x4d:                                                        // EOR abs
              addr = popWord();
              value = ram.read(addr);
              regA ^= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x4e:                                                     // LSR abs
              addr = popWord();
              value = ram.read(addr);
              regS = (regS&0xfe)|(value&1);
              value = value >> 1;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x50:                                                     // BVC (on overflow clear)
              offset = popByte();
              if((regS & 0x40) == 0) jumpBranch(offset);
              break;
          case 0x51:                                                     // EOR INDY
              zp = popByte();
              value = ram.read_word(zp) + regY;
              regA ^= ram.read(value);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x55:                                                     // EOR ZPX
              addr = (popByte() + regX) & 0xff;
              regA ^= ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x56:                                                     // LSR ZPX
              addr = (popByte() + regX) & 0xff;
              value = ram.read(addr);
              regS = (regS&0xfe) | (value&1);
              value = value >> 1;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x58:                                                     // CLI (does nothing)
              break;
          case 0x59:                                                     // EOR ABSY
              addr = popWord() + regY;
              value = ram.read(addr);
              regA ^= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x5d:                                                     // EOR ABSX
              addr = popWord() + regX;
              value = ram.read(addr);
              regA ^= value;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x5e:                                                     // LSR ABSX
              addr = popWord() + regX;
              value = ram.read(addr);
              regS = (regS&0xfe) | (value&1);
              value = value >> 1;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              sf = regS&1;
              addr = popByte();
              value = ram.read(addr);
              regS = (regS&0xfe)|(value&1);
              value = value >> 1;
              if(sf) value |= 0x80;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x68:                                                     // PLA
              regA = stackPop();
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x69:                                                     // ADC IMM
              value = popByte();
              testADC(value);
              break;
          case 0x6a:                                                     // ROR A
              sf = regS&1;
              regS = (regS&0xfe) | (regA&1);
              regA = regA >> 1;
              if(sf) regA |= 0x80;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              sf = regS&1;
              addr = popWord();
              value = ram.read(addr);
              regS = (regS&0xfe)|(value&1);
              value = value >> 1;
              if(sf) value |= 0x80;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x70:                                                     // BVS (branch on overflow set)
              offset = popByte();
              if(regS & 0x40) jumpBranch(offset);
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
              regS = (regS&0xfe) | (value&1);
              testADC(value);
              break;
          case 0x76:                                                     // ROR ZPX
              sf = (regS&1);
              addr = (popByte() + regX) & 0xff;
              value = ram.read(addr);
              regS = (regS&0xfe) | (value&1);
              value = value >> 1;
              if(sf) value |= 0x80;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              sf = regS&1;
              addr = popWord() + regX;
              value = ram.read(addr);
              regS = (regS&0xfe) | (value&1);
              value = value >> 1;
              if(value) value |= 0x80;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0x8a:                                                     // TXA (1 byte);
              regA = regX & 0xff;
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if((regS & 1) == 0) jumpBranch(offset);
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
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xa1:                                                     // LDA INDX
              zp = (popByte()+regX)&0xff;
              addr = ram.read_word(zp);
              regA = ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xa2:                                                     // LDX IMM
              regX = popByte();
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xa4:                                                     // LDY ZP
              regY = ram.read(popByte());
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xa5:                                                     // LDA ZP
              regA = ram.read(popByte());
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xa6:                                                    // LDX ZP
              regX = ram.read(popByte());
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xa8:                                                    // TAY
              regY = regA & 0xff;
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xa9:                                                    // LDA IMM
              regA = popByte();
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xaa:                                                    // TAX
              regX = regA & 0xff;
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xac:                                                    // LDY ABS
              regY = ram.read(popWord());
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xad:                                                    // LDA ABS
              regA = ram.read(popWord());
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xae:                                                    // LDX ABS
              regX = ram.read(popWord());
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xb0:                                                    // BCS
              offset = popByte();
              if(regS & 1) jumpBranch(offset);
              break;
          case 0xb1:                                                    // LDA INDY
              zp = popByte();
              addr = ram.read_word(zp) + regY;
              regA = ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break; 
          case 0xb4:                                                    // LDY ZPX
              regY = ram.read(popByte() + regX);
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xb5:                                                    // LDA ZPX
              regA = ram.read(popByte() + regX);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xb6:                                                    // LDX ZPY
              regX = ram.read(popByte() + regY);
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xb8:                                                    // CLV
              regS &= 0xbf;
              break;
          case 0xb9:                                                    // LDA ABSY
              addr = popWord() + regY;
              regA = ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xba:                                                    // TSX
              regX = regSP & 0xff;
              break;
          case 0xbc:                                                    // LDY ABSX
              addr = popWord() + regX;
              regY = ram.read(addr);
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xbd:                                                    // LDA ABSX
              addr = popWord() + regX;
              regA = ram.read(addr);
              if(regA) regS &= 0xfd; else regS |= 0x02;
              if(regA & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xbe:                                                    // LDX ABSY
              addr = popWord() + regY;
              regX = ram.read(addr);
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xc0:                                                    // CPY IMM
              value = popByte();
              if((regY+value) > 0xff) regS |= 1; else regS &= 0xfe;
              // TODO: is ov not used?
              //ov = value;
              value = (regY-value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xc8:                                                    // INY
              regY = (regY + 1) & 0xff;
              if(regY) regS &= 0xfd; else regS |= 0x02;
              if(regY & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xc9:                                                    // CMP IMM
              value = popByte();
              doCompare(regA, value);
              break;
          case 0xca:                                                    // DEX
              regX = (regX-1) & 0xff;
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xd0:                                                    // BNE
              offset = popByte();
  //            if((regS&2)==0) { oldPC = regPC; jumpBranch(offset); message("Jumping from " + addr2hex(oldPC) + " to " + addr2hex(regPC)); } else { message("NOT jumping!"); }
              if((regS&2)==0) jumpBranch(offset);
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
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xd8:                                                    // CLD (CLear Decimal)
              regS &= 0xf7;
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
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xe8:                                                    // INX
              regX = (regX + 1) & 0xff;
              if(regX) regS &= 0xfd; else regS |= 0x02;
              if(regX & 0x80) regS |= 0x80; else regS &= 0x7f;
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
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xf0:                                                 // BEQ
              offset = popByte();
              if(regS&2) jumpBranch(offset);
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
              regS = (regS&0xfe)|(value&1);
              testSBC(value);
              break;
          case 0xf6:                                                 // INC ZPX
              addr = popByte() + regX;
              value = ram.read(addr);
              ++value;
              value=value&0xff;
              ram.write(addr, value);
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          case 0xf8:                                                 // SED
              regS |= 8;
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
              if(value) regS &= 0xfd; else regS |= 0x02;
              if(value & 0x80) regS |= 0x80; else regS &= 0x7f;
              break;
          default:
// TODO: message callback
//              message("Address $" + addr2hex(regPC) + " - unknown opcode " + opcode);
              set_running(false);
              break;
      }

      if(regPC == 0) {
          set_running(false);
      }

      if(!is_running()) {
// TODO: message callback
//          message("program end at PC=$" + addr2hex(regPC-1));
      }
  }

   return {
      is_running: is_running,
      set_running: set_running,
      reset: reset
   };
}
