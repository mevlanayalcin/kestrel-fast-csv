// kestrel-fast-csv: WebAssembly v128 SIMD streaming JSON-to-JSON CSV transducer for csv-reader 1.0.0.
// Built from wasm_src/src/lib.rs (no_std Rust wasm32-unknown-unknown +simd128, 5813 B binary).

var W=Buffer.from("AGFzbQEAAAABIwZgAn9/AX9gAX8Bf2ADf39/AX9gBX9/f39/AX9gAAF/YAAAAxAPAAECAQMEAgAFAgQEBAEFBQMBAAEGEwN/AUGAIAt/AEHAIwt/AEHAIwsHWgcGbWVtb3J5AgAJaGVhcF9iYXNlAAoLX19oZWFwX2Jhc2UDAQtyZWFkX3dpbmRvdwALCXN0YXRlX3B0cgAMDHdyaXRlX2Vycm9ycwANCl9fZGF0YV9lbmQDAgrfKA+1AQEBfwJAAkAgAC0AASICQSJGDQAgAkHcAEYNACACQS9GDQACQCACQZ5/ag4FAQICAgEACwJAIAJBjH9qDgIBAAILAkACQCAAEIGAgIAAIgJBAEgNAAJAIAJBdmoOBAECAgEACyACQSxGDQAgAkEiRw0BC0EAQX82ArijgIAAQQAPCyABIAAoAAA2AAAgASAALwAEOwAEQQYPCyABIAAvAAA7AABBAg8LQQBBfzYCuKOAgABBAAuOAQEEfyAAQQJqIQFBACEAQQAhAgN/AkACQAJAAkAgAEEERg0AIAEgAGotAAAiA0FQaiIEQf8BcUEKSQ0DIANBn39qQf8BcUEGSQ0BIANBv39qQf8BcUEGSQ0CQX8hAgsgAg8LIANBqX9qIQQMAQsgA0FJaiEECyACQQR0IARB/wFxciECIABBAWohAAwACwuMAwEFf0EAKAL0ooCAACEDQQAoArCjgIAAIQQgASEFAkACQAJAAkADQAJAAkAgAC0AACIGQdwARg0AAkAgBkEiRg0AIAZBLEcNAkEAIQIgBSABTQ0HDAYLIAAgBE8NBEECIQIgBSABSw0FDAYLIAAgAksNAwJAIAAoAAAiBkEIdkH/AXEiB0HuAEcNAEEBIQJBAEEAKALwooCAAEEBajYC8KKAgAAgAEECaiEAIAUgAUsNBQwGCwJAIAZB3OTx8gZHDQBBASECQQBBACgC8KKAgABBAWo2AvCigIAAIABBBGohACAFIAFLDQUMBgsCQCAHQfIARw0AIAAQg4CAgAAhAEEAKAK4o4CAAEUNAgwDCyAAIAUQgICAgAAhBkEAKAK4o4CAAA0CIAUgBmohBSAAIAZqIQAMAQsgBSAGOgAAIABBAWohACAFQQFqIQUMAAsLQQIPC0EDIQIMAQtBAUEAKAKco4CAACADQQBBABCEgICAABoLQQAgBTYC7KKAgABBACAANgLoooCAACACC1oBAX8CQEEAQQAoApyjgIAAQQAoAvSigIAAQQBBABCEgICAAA0AIAAPCyAAQQJqIQECQCAALwACQdzqAUcNACABEIGAgIAAQQpHDQBBAEF/NgK4o4CAAAsgAQt1AQN/AkACQEEAKAL8ooCAACIFQQAoAtyigIAAIgZPDQBBACgC2KKAgAAgBUEUbGoiByAENgIQIAcgAzYCDCAHIAI2AgggByABNgIEIAcgADYCAEEAIAVBAWo2AvyigIAADAELQQBBBDYCuKOAgAALIAUgBkkLcwEBf0EAQQAoApijgIAANgL8ooCAAEEAQQAoApyjgIAANgLwooCAAEEAQQAoApCjgIAAQQAoAsCigIAAazYC6KKAgABBAEEAKAKUo4CAAEEAKALMooCAAGs2AuyigIAAQQAoArijgIAAIgBBASAAQQFLGwuSBAEEf0EAKAL0ooCAACEDAkACQAJAAkACQAJAQQAoAviigIAAIgRBAEgNAAJAIAQgAUoNAEEAKAKUo4CAAEECQQMgA0ECSRtqIQEDQCABIQIDQEECIQECQCACLQAAIgVB3ABGDQACQCAFQSJHDQAgAkEDaiEBIARBf2oiBA0DQQAoAoCjgIAAIgYgACABayIEaiIFQQAoAuSigIAASw0IAkAgBEUNAEEAKALgooCAACAGaiABIAT8CgAAC0EEQQAoApyjgIAAIAMgBiAEEISAgIAARQ0KQQAgBTYCgKOAgAAgAiEADAYLQQEhAQsgAiABaiECDAALCwsgAEEAKALMooCAAGtBAEEAKALIooCAACIFQQAoAsCigIAAIAJraiICIAIgBUsbIAQgAWtqQQNsakGAEGoiAkEAKALQooCAAEsNBCAAQSI6AAAgAEEBaiECA0ACQCABIARHDQAgAkHdADoAACACQQFqIQBBA0EAKAKco4CAACADIAFBABCEgICAAA0EDAcLIAJBrMSIATYAACAEQX9qIQQgAkEDaiECDAALC0EAIAE2AviigIAACyAAQaK6ATsAACAAQQJqIQALIAMNAkEAIABBACgCzKKAgABrNgKEo4CAACAAQQlqDwtBAEEFNgK4o4CAAEEAIAU2AoyjgIAAIAAPC0EAQQM2ArijgIAAQQAgAjYCiKOAgAALIAALwAEBA38jgICAgABBEGsiAiSAgICAAAJAAkAgAQ0AIABBMDoAACAAQQFqIQAMAQtBACEDIAJBCGpBADsBACACQgA3AwADQAJAIAENACADQX9qIQEDQCABQX9GDQMgACACIAFqLQAAOgAAIAFBf2ohASAAQQFqIQAMAAsLAkAgA0EKRg0AIAIgA2ogAUEKbiIEQfYBbCABakEwcjoAACADQQFqIQMgBCEBDAELCxCIgICAAAALIAJBEGokgICAgAAgAAsJABCOgICAAAALMAADfwJAIAINACAADwsgACABLQAAOgAAIAJBf2ohAiABQQFqIQEgAEEBaiEADAALCwsAQf+jgIAAQUBxC6AWBwV/AnsDfwF7AX8BewN/QQAhAEEAKALMooCAACEBQQAoAsCigIAAIQICQAJAQQAoAsSigIAAIgNB/////wdHDQBBfyEAQQBBfzYCsKOAgAAMAQtBACADIAJqIgQ2ArCjgIAAIANBB00NACAEQXhqIQALQQBBf0EAKALUooCAACIDIAFqIANB/////wdGGzYCtKOAgABBAEEANgK4o4CAACABQQAoAuyigIAAaiEEIAJBACgC6KKAgABqIQNBAP0ABICggIAAIQVBAP0ABJCggIAAIQZBACgC+KKAgAAhB0EAKAL0ooCAACEIQQAoAvCigIAAIQlBAP0ABKCggIAAIQoCQANAAkACQAJAAkACQAJAAkACQAJAQQAoArSjgIAAIARJDQBBACAJNgKco4CAAEEAIAQ2ApSjgIAAQQAgAzYCkKOAgABBAEEAKAL8ooCAADYCmKOAgAACQAJAIAMoAAAiAkHc5PHyBkYNACACQf//A3FB3NwBRw0BCwNAIAMgAEsNAwJAAkAgAkH//wNxQdzcAUcNAEECIQEMAQsgAkHc5PHyBkcNAkEEIQELIAlBAWohCSADIAFqIgMoAAAhAgwACwsCQCACQf8BcUEiRw0AQQAoArCjgIAAIANLDQtBACAINgL0ooCAAAwGC0EAIAk2ApyjgIAAQQAgAzYCkKOAgAACQAJAIAhBAUsNACAEQdvEADsAAEECIQEMAQsgBEGstokBNgAAQQMhAQtBACELQQAgBCABaiIBNgKoo4CAAEEAIAJB//8DcUHcxABGIgI2AqyjgIAAAkACQAJAIAINAEEAIQQgAyECDAELIAMgAEsNAUEAIAk2AqSjgIAAQQAgA0ECaiICNgKgo4CAAEEBIQQLA0ACQCAEQQFxDQADQCACIQMCQAJAAkADQCABIAP9AAAAIgz9CwAAIAwgBf0j/WQhDSAMIAr9IyAMIAb9I/1Q/WQiAg0BIA0NAiABQRBqIQEgA0EQaiEDDAALCyACaCEOAkACQAJAIAJBACACa3FBf2ogDXEiD0UNACABIA9oIg1qIgFBotiIATYAACAPQX9qIA9xIQIMAQsgASAOaiEBDAELAkADQCANQQFqIQQgAUEDaiEBIAJFDQEgASADIARq/QAAAP0LAAAgASACaCINIARraiIBQaLYiAE2AAAgAkF/aiACcSECDAALCyAPaSALaiELAkAgDiAERw0AQQAgATYCqKOAgAAgAyAOaiICLwAAQdzEAEcNAQJAIAIgAEsNACACQQJqIQIMBAtBACAINgL0ooCAAAwNCyABIAMgBGr9AAAA/QsAACABIA4gBGtqIQELAkACQAJAAkACQAJAIAMgDmoiAy0AAEHcAEcNACADIABLDQEgAygAACICQf//A3EiBEHc3AFHDQIgCUEBaiEJIANBAmohAwwOC0EAKAKwo4CAACADTQ0CDA4LQQAgCDYC9KKAgAAMDwsCQCACQdzk8fIGRw0AIAlBAWohCSADQQRqIQMMDAsgBEHcxABGDQECQCAEQdzkAUcNAEEAIAg2AvSigIAAIAMQg4CAgAAhAkEAKAK4o4CAAEUNBkEAIAg2AvSigIAADA8LIAMgARCAgICAACECQQAoArijgIAARQ0CQQAgCDYC9KKAgAAMDgtBACAINgL0ooCAAAwNCyABQdzEADsAACABQQJqIQEgA0ECaiECDAMLIAEgAmohASADIAJqIQIMAgsgASANaCIOaiIBQaLYiAE2AAAgDUF/aiANcSECA0AgDkEBaiEEIAFBA2ohAQJAIAINACANaSALaiELAkACQCAOQQ9JDQBBACABNgKoo4CAACADQRBqIQIgAy8AEEHcxABGDQEMBQsgASADIARq/QAAAP0LAAAgA0EQaiECIAEgDmtBD2ohAQwECwJAIAIgAEsNACADQRJqIQIMAwtBACAINgL0ooCAAAwMCyABIAMgBGr9AAAA/QsAACABIAJoIg4gBGtqIgFBotiIATYAACACQX9qIAJxIQIMAAsLC0EAIAk2AqSjgIAAQQAgAjYCoKOAgAALA0AgASAC/QAAACIM/QsAAAJAIAwgCv0jIAwg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","base64");
var NO_END=0x7fffffff,PAD=64,UNREADABLE=new Error();
var WIN_IN=1<<20,WIN_OUT=1<<20;
var ex=null,mem=null,S_PTR=0,H_BASE=0;
var inCap=0,errCap=0,extraCap=0,outCap=0,inPtr=0,errPtr=0,extraPtr=0,outPtr=0,u8=null,S=null;
var patchBuf=new Uint8Array(32);

function init(wIn,wOut){
  if(ex===null){
    ex=new WebAssembly.Instance(new WebAssembly.Module(W)).exports;
    mem=ex.memory;S_PTR=ex.state_ptr();H_BASE=ex.heap_base();
    inCap=wIn;errCap=4096;extraCap=65536;outCap=wOut+3*wIn+4096;
    layout(false);
  }
}

function layout(preserve){
  var oldO=preserve?S[11]:0,oldNerr=preserve?S[15]:0,oldNextras=preserve?S[16]:0;
  var oldOut=outPtr,oldExt=extraPtr,oldErr=errPtr;
  var nIn=H_BASE;
  var nErr=(nIn+inCap+PAD+63)&~63;
  var nExt=(nErr+errCap*20+63)&~63;
  var nOut=(nExt+extraCap+63)&~63;
  var needP=((nOut+outCap+64)+65535)>>>16;
  var curP=mem.buffer.byteLength>>>16;
  if(needP>curP)mem.grow(needP-curP);
  var b=new Uint8Array(mem.buffer);
  if(preserve){
    if(nOut!==oldOut&&oldO>0)b.copyWithin(nOut,oldOut,oldOut+oldO);
    if(nExt!==oldExt&&oldNextras>0)b.copyWithin(nExt,oldExt,oldExt+oldNextras);
    if(nErr!==oldErr&&oldNerr>0)b.copyWithin(nErr,oldErr,oldErr+oldNerr*20);
  }
  inPtr=nIn;errPtr=nErr;extraPtr=nExt;outPtr=nOut;
  u8=b;S=new Int32Array(mem.buffer,S_PTR,24);
  S[0]=inPtr;S[3]=outPtr;S[4]=outCap;S[6]=errPtr;S[7]=errCap;S[8]=extraPtr;S[9]=extraCap;
}

function hexVal(c){
  if(c>=48&&c<=57)return c-48;
  if(c>=97&&c<=102)return c-87;
  if(c>=65&&c<=70)return c-55;
  return -1;
}

function hex4(idx){
  var a=hexVal(u8[idx+2]),b=hexVal(u8[idx+3]),c=hexVal(u8[idx+4]),d=hexVal(u8[idx+5]);
  if((a|b|c|d)<0)throw UNREADABLE;
  return(a<<12)|(b<<8)|(c<<4)|d;
}

function writeAscii(ptr,s){for(var j=0;j<s.length;j++)u8[ptr+j]=s.charCodeAt(j);}

export function run(input){
  init(WIN_IN,WIN_OUT);
  var t=String(input.text),header=input.header===true,lit=JSON.stringify(t),n=Buffer.byteLength(lit,"utf8");
  if(n+PAD>inCap||3*n+4096>outCap){
    while(inCap<n+PAD)inCap*=2;
    while(outCap<3*n+4096)outCap*=2;
    layout(false);
  }
  Buffer.from(mem.buffer,inPtr,n).write(lit,0,n,"utf8");
  u8.fill(0x22,inPtr+n,inPtr+n+PAD);
  var i=1;
  if(u8[inPtr+1]===0xef&&u8[inPtr+2]===0xbb&&u8[inPtr+3]===0xbf)i=4;
  S[1]=NO_END;S[2]=n;S[5]=NO_END;S[10]=i;S[11]=24;S[12]=1;S[13]=0;S[14]=-1;S[15]=0;S[16]=0;S[17]=-1;
  var rec0End=24;
  for(;;){
    var rc=ex.read_window();
    if(S[17]>=0){rec0End=S[17];S[17]=-1;}
    if(rc===0)break;
    if(rc===3){while(outCap<S[18])outCap*=2;layout(true);continue;}
    if(rc===4){errCap*=2;layout(true);continue;}
    if(rc===5){while(extraCap<S[19])extraCap*=2;layout(true);continue;}
    throw UNREADABLE;
  }
  var kept=S[13];
  if(kept===0)writeAscii(outPtr,header?'  {"columns":[],"rows":[':'{"columns":null,"rows":[');
  else{
    writeAscii(outPtr,header?'             {"columns":':'{"columns":null,"rows":[');
    writeAscii(outPtr+rec0End,header?',"rows":[':kept>=2?',        ':'         ');
  }
  var needErr=S[11]+S[15]*96+S[16]+128;
  if(needErr>outCap){while(outCap<needErr)outCap*=2;layout(true);}
  var outLen=ex.write_errors(header?1:0);
  return JSON.parse(Buffer.from(mem.buffer,outPtr,outLen).toString("utf8"));
}

export function answerCases(read,write,winIn=WIN_IN,winOut=WIN_OUT){
  init(winIn,winOut);
  if(winIn>inCap||winOut+3*winIn+4096>outCap){
    if(winIn>inCap)inCap=winIn;
    var needO=winOut+3*inCap+4096;
    if(needO>outCap)outCap=needO;
    layout(false);
  }
  var cap=winIn,wlen=0,srcBase=0,eof=false,o=0,outBase=0,p=0,caseBaseAbs=0,rec0EndAbs=0;
  function setWin(n,ended){wlen=n;eof=ended;u8.fill(0x22,inPtr+n,inPtr+n+PAD);S[1]=ended?NO_END:n;S[2]=n;}
  function refill(from){
    var keep=wlen-from;
    if(from===0&&keep>=cap){
      cap*=2;if(cap>inCap)inCap=cap;
      var needO=o+3*(cap+PAD)+4096;if(needO>outCap)outCap=needO;
      S[11]=o;layout(true);
    }else if(from>0&&keep>0)u8.copyWithin(inPtr,inPtr+from,inPtr+wlen);
    srcBase+=from;var n=keep,ended=eof;
    while(!ended&&n<cap){var r=read(u8,inPtr+n,cap-n,srcBase+n);if(r<=0)ended=true;else n+=r;}
    setWin(n,ended);return from;
  }
  function ensureOut(need){if(o+need<=outCap)return;while(outCap<o+need)outCap*=2;S[11]=o;layout(true);}
  function flush(){if(o>0){write(u8,outPtr,o,outBase);outBase+=o;o=0;}}
  function patch(abs,str){
    var len=str.length;
    for(var j=0;j<len;j++){var at=abs+j;if(at>=outBase)u8[outPtr+(at-outBase)]=str.charCodeAt(j);}
    if(abs<outBase){var n=Math.min(len,outBase-abs);for(var j=0;j<n;j++)patchBuf[j]=str.charCodeAt(j);write(patchBuf,0,n,abs);}
  }
  function ensureIn(n){while(p+n>wlen&&!eof)p-=refill(p);}
  function ws(){for(;;){ensureIn(64);var c=u8[inPtr+p];if(c===32||c===10||c===13||c===9)p++;else return;}}
  function expect(c){ws();if(u8[inPtr+p]!==c||p>=wlen)throw UNREADABLE;p++;}
  function key(){
    expect(34);ensureIn(256);var k="";
    for(;;){var c=u8[inPtr+p];if(c===34)break;if(c===92||c<32||k.length>200)throw UNREADABLE;k+=String.fromCharCode(c);p++;}
    if(p>=wlen)throw UNREADABLE;p++;expect(58);return k;
  }
  function skipVal(){
    ws();var c=u8[inPtr+p];
    if(c===34){
      p++;for(;;){ensureIn(8);var d=u8[inPtr+p];if(d===34)break;if(d<32)throw UNREADABLE;p+=d===92?2:1;}
      if(p>=wlen)throw UNREADABLE;p++;
    }else if(c===123||c===91){
      var cl=c+2;p++;ws();if(u8[inPtr+p]===cl){p++;return;}
      for(;;){if(c===123)key();skipVal();ws();if(u8[inPtr+p]===44)p++;else if(u8[inPtr+p]===cl){p++;return;}else throw UNREADABLE;}
    }else{
      var at=p;
      for(;;){ensureIn(8);var d=u8[inPtr+p];if((d>=48&&d<=57)||(d>=97&&d<=122)||d===45||d===43||d===46||d===69)p++;else break;}
      if(p===at||p>wlen)throw UNREADABLE;
    }
  }
  function readText(){
    ensureIn(64);ensureOut(3*wlen+2048);
    caseBaseAbs=outBase+o;o+=24;rec0EndAbs=outBase+o;
    var i=p;
    if(u8[inPtr+i]===0xef&&u8[inPtr+i+1]===0xbb&&u8[inPtr+i+2]===0xbf)i+=3;
    else if(u8[inPtr+i]===0x5c&&u8[inPtr+i+1]===0x75&&hex4(inPtr+i)===0xfeff)i+=6;
    S[5]=winOut;S[10]=i;S[11]=o;S[12]=1;S[13]=0;S[14]=-1;S[15]=0;S[16]=0;S[17]=-1;
    for(;;){
      var rc=ex.read_window();
      if(S[17]>=0){rec0EndAbs=outBase+S[17];S[17]=-1;}
      if(rc===0){p=S[10]+1;o=S[11];return;}
      if(rc===2){o=S[11];flush();S[11]=0;continue;}
      if(rc===1){if(eof)throw UNREADABLE;o=S[11];S[10]-=refill(S[10]);ensureOut(3*wlen+2048);S[11]=o;continue;}
      if(rc===3){o=S[11];while(outCap<S[18])outCap*=2;layout(true);continue;}
      if(rc===4){o=S[11];errCap*=2;layout(true);continue;}
      if(rc===5){o=S[11];while(extraCap<S[19])extraCap*=2;layout(true);continue;}
      throw UNREADABLE;
    }
  }
  function writeAnswer(header){
    var kept=S[13];
    if(kept===0)patch(caseBaseAbs,header?'  {"columns":[],"rows":[':'{"columns":null,"rows":[');
    else{
      patch(caseBaseAbs,header?'             {"columns":':'{"columns":null,"rows":[');
      patch(rec0EndAbs,header?',"rows":[':kept>=2?',        ':'         ');
    }
    ensureOut(S[15]*96+S[16]+128);S[11]=o;o=ex.write_errors(header?1:0);
  }
  function readInputObj(){
    expect(123);var header=false,haveText=false,haveHeader=false;ws();
    if(u8[inPtr+p]!==125){
      for(;;){
        var k=key();ws();
        if(k==="text"){if(haveText||u8[inPtr+p]!==34)throw UNREADABLE;haveText=true;p++;readText();}
        else if(k==="header"){
          if(haveHeader)throw UNREADABLE;haveHeader=true;ensureIn(8);
          if(u8[inPtr+p]===0x74&&u8[inPtr+p+1]===0x72&&u8[inPtr+p+2]===0x75&&u8[inPtr+p+3]===0x65){
            var nx=u8[inPtr+p+4];
            if(nx===44||nx===125||nx===32||nx===10||nx===13||nx===9){header=true;p+=4;}else throw UNREADABLE;
          }else skipVal();
        }else skipVal();
        ws();if(u8[inPtr+p]===44)p++;else break;
      }
    }
    expect(125);if(!haveText)throw UNREADABLE;writeAnswer(header);
  }
  try{
    refill(0);expect(91);ensureOut(1);u8[outPtr+o++]=91;ws();
    if(u8[inPtr+p]===93)p++;
    else{
      for(var n=0;;n++){
        if(n>0){ensureOut(1);u8[outPtr+o++]=44;}
        expect(123);var haveInput=false;
        for(;;){
          var k=key();
          if(k==="input"){if(haveInput)throw UNREADABLE;haveInput=true;readInputObj();}
          else skipVal();
          ws();if(u8[inPtr+p]===44)p++;else break;
        }
        expect(125);if(!haveInput)throw UNREADABLE;ws();
        if(u8[inPtr+p]===44)p++;else break;
      }
      expect(93);
    }
    ws();if(p!==wlen||!eof)throw UNREADABLE;
    ensureOut(1);u8[outPtr+o++]=93;flush();return true;
  }catch{return false;}
}

export function main(){
  try{
    process.noDeprecation=true;
    var f=process.binding("v8").setFlagsFromString;
    if(typeof f==="function")f("--no-incremental-marking --liftoff-only --wasm-lazy-compilation");
  }catch{}
  var fs=process.getBuiltinModule("node:fs");
  var input=(process.env.MAKEFUN_INPUT_DIR??"/input")+"/cases.json";
  var output=(process.env.MAKEFUN_OUTPUT_DIR??"/output")+"/answers.json";
  var inFd=fs.openSync(input,"r"),outFd=fs.openSync(output,"w");
  var done=answerCases(
    (b,a,l,p)=>fs.readSync(inFd,b,a,l,p),
    (b,a,l,p)=>{for(var n=0;n<l;)n+=fs.writeSync(outFd,b,a+n,l-n,p+n);}
  );
  fs.closeSync(inFd);fs.closeSync(outFd);
  if(!done){
    var cases=JSON.parse(fs.readFileSync(input,"utf8")),answers=[];
    for(var c of cases)answers.push(run(c.input));
    fs.writeFileSync(output,JSON.stringify(answers));
  }
}
