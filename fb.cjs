module.exports=function fallback(inp,out,ex,mem,SP,HB){
  var fs=process.getBuiltinModule("node:fs"),NO_END=0x7fffffff,PAD=96;
  var iC=262144,eC=4096,xC=65536,oC=1048576,iP=0,eP=0,xP=0,oP=0,u8,S;
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
  function wa(ptr,s){for(var j=0;j<s.length;j++)u8[ptr+j]=s.charCodeAt(j);}
  function runOne(input){
    var t=String(input.text),h=input.header===true,lit=JSON.stringify(t),n=Buffer.byteLength(lit,"utf8");
    if(n+PAD>iC||3*n+4096>oC){while(iC<n+PAD)iC*=2;while(oC<3*n+4096)oC*=2;ly(false);}
    Buffer.from(mem.buffer,iP,n).write(lit,0,n,"utf8");
    u8.fill(0x22,iP+n,iP+n+PAD);
    var i=1;if(u8[iP+1]===0xef&&u8[iP+2]===0xbb&&u8[iP+3]===0xbf)i=4;
    S[1]=NO_END;S[2]=n;S[5]=NO_END;S[10]=i;S[11]=24;S[12]=1;S[13]=0;S[14]=-1;S[15]=0;S[16]=0;S[17]=-1;
    var r0=24;
    for(;;){
      var rc=ex.read_window();
      if(S[17]>=0){r0=S[17];S[17]=-1;}
      if(rc===0)break;
      if(rc===3){while(oC<S[18])oC*=2;ly(true);continue;}
      if(rc===4){eC*=2;ly(true);continue;}
      if(rc===5){while(xC<S[19])xC*=2;ly(true);continue;}
      throw new Error("csv-wasm fallback failed");
    }
    var k=S[13];
    if(k===0)wa(oP,h?'  {"columns":[],"rows":[':'{"columns":null,"rows":[');
    else{wa(oP,h?'             {"columns":':'{"columns":null,"rows":[');wa(oP+r0,h?',"rows":[':k>=2?',        ':'         ');}
    var ne=S[11]+S[15]*96+S[16]+128;
    if(ne>oC){while(oC<ne)oC*=2;ly(true);}
    var ol=ex.write_errors(h?1:0);
    return JSON.parse(Buffer.from(mem.buffer,oP,ol).toString("utf8"));
  }
  var cases=JSON.parse(fs.readFileSync(inp,"utf8")),ans=[];
  for(var c of cases)ans.push(runOne(c.input));
  fs.writeFileSync(out,JSON.stringify(ans));
};
