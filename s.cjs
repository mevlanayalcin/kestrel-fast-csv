try{process.noDeprecation=true;var f=process.binding("v8").setFlagsFromString;if(typeof f==="function")f("--no-incremental-marking --liftoff-only --wasm-lazy-compilation");}catch{}
var fs=process.getBuiltinModule("node:fs"),W=new Uint8Array(6732),wd=fs.openSync(__dirname+"/w.wasm","r");
for(var wn=0;wn<6732;){var r=fs.readSync(wd,W,wn,6732-wn,wn);if(r<=0)break;wn+=r;}
fs.closeSync(wd);
var NO_END=0x7fffffff,PAD=96,U=new Error(),WI=262144,WO=262144;
var ex=new WebAssembly.Instance(new WebAssembly.Module(W)).exports,mem=ex.memory,SP=ex.state_ptr(),HB=ex.heap_base();
var iC=WI,eC=4096,xC=65536,oC=WO+3*WI+4096,iP=0,eP=0,xP=0,oP=0,u8,S,pb=new Uint8Array(32);
function ly(pr){
  var oo=pr?S[11]:0,on=pr?S[15]:0,ox=pr?S[16]:0,oO=oP,oX=xP,oE=eP;
  var nI=HB,nE=(nI+iC+PAD+63)&~63,nX=(nE+eC*20+63)&~63,nO=(nX+xC+63)&~63;
  var np=((nO+oC+64)+65535)>>>16,cp=mem.buffer.byteLength>>>16;
  if(np>cp)mem.grow(np-cp);
  var b=new Uint8Array(mem.buffer);
  if(pr){if(nO!==oO&&oo>0)b.copyWithin(nO,oO,oO+oo);if(nX!==oX&&ox>0)b.copyWithin(nX,oX,oX+ox);if(nE!==oE&&on>0)b.copyWithin(nE,oE,oE+on*20);}
  iP=nI;eP=nE;xP=nX;oP=nO;u8=b;S=new Int32Array(mem.buffer,SP,24);
  S[0]=iP;S[3]=oP;S[4]=oC;S[6]=eP;S[7]=eC;S[8]=xP;S[9]=xC;
}
ly(false);
function hv(c){return c>=48&&c<=57?c-48:c>=97&&c<=102?c-87:c>=65&&c<=70?c-55:-1;}
function h4(k){var a=hv(u8[k+2]),b=hv(u8[k+3]),c=hv(u8[k+4]),d=hv(u8[k+5]);if((a|b|c|d)<0)throw U;return(a<<12)|(b<<8)|(c<<4)|d;}
var inp=(process.env.MAKEFUN_INPUT_DIR??"/input")+"/cases.json",out=(process.env.MAKEFUN_OUTPUT_DIR??"/output")+"/answers.json";
var iF=fs.openSync(inp,"r"),oF=fs.openSync(out,"w"),cap=WI,wl=0,sb=0,eof=false,o=0,ob=0,p=0,cA=0,rA=0;
function sw(n,e){wl=n;eof=e;u8.fill(0x22,iP+n,iP+n+PAD);S[1]=e?NO_END:n;S[2]=n;}
function rf(fr){
  var k=wl-fr;
  if(fr===0&&k>=cap){cap*=2;if(cap>iC)iC=cap;var no=o+3*(cap+PAD)+4096;if(no>oC)oC=no;S[11]=o;ly(true);}
  else if(fr>0&&k>0)u8.copyWithin(iP,iP+fr,iP+wl);
  sb+=fr;var n=k,e=eof;
  while(!e&&n<cap){var r=fs.readSync(iF,u8,iP+n,cap-n,sb+n);if(r<=0)e=true;else n+=r;}
  sw(n,e);return fr;
}
function eo(nd){if(o+nd<=oC)return;while(oC<o+nd)oC*=2;S[11]=o;ly(true);}
function wa(b,a,l,pos){for(var n=0;n<l;)n+=fs.writeSync(oF,b,a+n,l-n,pos+n);}
function fl(){if(o>0){wa(u8,oP,o,ob);ob+=o;o=0;}}
function pt(abs,s){var l=s.length;for(var j=0;j<l;j++){var at=abs+j;if(at>=ob)u8[oP+(at-ob)]=s.charCodeAt(j);}if(abs<ob){var n=Math.min(l,ob-abs);for(var j=0;j<n;j++)pb[j]=s.charCodeAt(j);wa(pb,0,n,abs);}}
function ei(n){while(p+n>wl&&!eof)p-=rf(p);}
function ws(){for(;;){ei(64);var c=u8[iP+p];if(c===32||c===10||c===13||c===9)p++;else return;}}
function exC(c){ws();if(u8[iP+p]!==c||p>=wl)throw U;p++;}
function ky(){exC(34);ei(256);var k="";for(;;){var c=u8[iP+p];if(c===34)break;if(c===92||c<32||k.length>200)throw U;k+=String.fromCharCode(c);p++;}if(p>=wl)throw U;p++;exC(58);return k;}
function sk(){ws();var c=u8[iP+p];if(c===34){p++;for(;;){ei(8);var d=u8[iP+p];if(d===34)break;if(d<32)throw U;p+=d===92?2:1;}if(p>=wl)throw U;p++;}else if(c===123||c===91){var cl=c+2;p++;ws();if(u8[iP+p]===cl){p++;return;}for(;;){if(c===123)ky();sk();ws();if(u8[iP+p]===44)p++;else if(u8[iP+p]===cl){p++;return;}else throw U;}}else{var at=p;for(;;){ei(8);var d=u8[iP+p];if((d>=48&&d<=57)||(d>=97&&d<=122)||d===45||d===43||d===46||d===69)p++;else break;}if(p===at||p>wl)throw U;}}
function rt(){
  ei(64);eo(3*wl+2048);cA=ob+o;o+=24;rA=ob+o;var i=p;
  if(u8[iP+i]===0xef&&u8[iP+i+1]===0xbb&&u8[iP+i+2]===0xbf)i+=3;
  else if(u8[iP+i]===0x5c&&u8[iP+i+1]===0x75&&h4(iP+i)===0xfeff)i+=6;
  S[5]=WO;S[10]=i;S[11]=o;S[12]=1;S[13]=0;S[14]=-1;S[15]=0;S[16]=0;S[17]=-1;
  for(;;){
    var rc=ex.read_window();
    if(S[17]>=0){rA=ob+S[17];S[17]=-1;}
    if(rc===0){p=S[10]+1;o=S[11];return;}
    if(rc===2){o=S[11];fl();S[11]=0;continue;}
    if(rc===1){if(eof)throw U;o=S[11];S[10]-=rf(S[10]);eo(3*wl+2048);S[11]=o;continue;}
    if(rc===3){o=S[11];while(oC<S[18])oC*=2;ly(true);continue;}
    if(rc===4){o=S[11];eC*=2;ly(true);continue;}
    if(rc===5){o=S[11];while(xC<S[19])xC*=2;ly(true);continue;}
    throw U;
  }
}
function wa2(h){
  var k=S[13];
  if(k===0)pt(cA,h?'  {"columns":[],"rows":[':'{"columns":null,"rows":[');
  else{pt(cA,h?'             {"columns":':'{"columns":null,"rows":[');pt(rA,h?',"rows":[':k>=2?',        ':'         ');}
  eo(S[15]*96+S[16]+128);S[11]=o;o=ex.write_errors(h?1:0);
}
function ri(){
  exC(123);var h=false,ht=false,hh=false;ws();
  if(u8[iP+p]!==125){for(;;){
    var k=ky();ws();
    if(k==="text"){if(ht||u8[iP+p]!==34)throw U;ht=true;p++;rt();}
    else if(k==="header"){if(hh)throw U;hh=true;ei(8);if(u8[iP+p]===0x74&&u8[iP+p+1]===0x72&&u8[iP+p+2]===0x75&&u8[iP+p+3]===0x65){var nx=u8[iP+p+4];if(nx===44||nx===125||nx===32||nx===10||nx===13||nx===9){h=true;p+=4;}else throw U;}else sk();}
    else sk();
    ws();if(u8[iP+p]===44)p++;else break;
  }}
  exC(125);if(!ht)throw U;wa2(h);
}
try{
  rf(0);exC(91);eo(1);u8[oP+o++]=91;ws();
  if(u8[iP+p]===93)p++;
  else{for(var n=0;;n++){
    if(n>0){eo(1);u8[oP+o++]=44;}
    exC(123);var hi=false;
    for(;;){var k=ky();if(k==="input"){if(hi)throw U;hi=true;ri();}else sk();ws();if(u8[iP+p]===44)p++;else break;}
    exC(125);if(!hi)throw U;ws();if(u8[iP+p]===44)p++;else break;
  }exC(93);}
  ws();if(p!==wl||!eof)throw U;
  eo(1);u8[oP+o++]=93;fl();fs.closeSync(iF);fs.closeSync(oF);
}catch{
  try{fs.closeSync(iF);}catch{}
  try{fs.closeSync(oF);}catch{}
  require("./fb.cjs")(inp,out,ex,mem,SP,HB);
}
