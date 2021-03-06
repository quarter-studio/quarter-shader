// vertex shader
vs = `
attribute vec4 position;

void main() {
  gl_Position = position;
}
`;

//fragment shader
fs = `
// Author: Tobias Toft
// Title: Mountain ridges for Quarter Studio, v. 0.0.1
// Heavily inspired by and based on the 'noise holes' shader found here: https://www.shadertoy.com/view/XdyXz3

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_texture;
uniform sampler2D u_terrain;

// Generic random
float random(vec2 st) {
  float a = 12.9898;
  float b = 78.233;
  float c = 43758.5453;
  float dt= dot(st.xy ,vec2(a,b));
  float sn= mod(dt,3.14);
  return fract(sin(sn) * c);
}

// Fast simplex-ish noise from
// https://www.shadertoy.com/view/Msf3WH

vec2 hash(vec2 p){ // replace this by something better
  p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float snoise(in vec2 p){
  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
  const float K2 = 0.211324865; // (3-sqrt(3))/6;

  vec2  i = floor( p + (p.x+p.y)*K1 );
  vec2  a = p - i + (i.x+i.y)*K2;
  float m = step(a.y,a.x);
  vec2  o = vec2(m,1.0-m);
  vec2  b = a - o + K2;
  vec2  c = a - 1.0 + 2.0*K2;
  o.x = 1.0-o.y;
  vec3  h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
  vec3  n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
  return dot( n, vec3(70.0) );
}

//--

const float STEPS = 2.;
const float LINE_WIDTH = 0.002;
const float CUTOFF = 0.4;
float ZOOM = 0.5;
float posX = u_mouse.x * 0.1;
float posY = u_mouse.y * 0.1;
vec2 mouseUV = u_mouse / u_resolution;


vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float getNoise(vec2 uv, float t){
  //given a uv coord and time - return a noise val in range 0 - 1
  //using ashima noise

  //octave 1
  float SCALEX = 1. * ZOOM;
  float SCALEY = 2. * ZOOM * posY * 10.;
  float noise = snoise( vec2(uv.x * SCALEX + posX + t, (uv.y * SCALEY + t)));

  //octave 2
  float SCALE = 1.;
  noise += snoise( vec2((uv.x + posX + t/10000.) * 2., (uv.y + t/10000.) * 2.)) * 0.5 ;

  //move noise into 0 - 1 range
  noise = (noise/2. + 0.5);

  return noise;
}

float getDepth(float n){
  //remap remaining non-cutoff region to 0 - 1
  float d = (n - CUTOFF) / (1. - CUTOFF);

  //step
  d = floor(d*STEPS)/STEPS;

  return d;
}

void main(){
  float t = u_time * 0.01;
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec3 col = vec3(0);
  float staticNoise = (texture2D(u_texture, uv * u_resolution.x / 256. + u_time * 0.1).r - 0.5) * .1;

  float noise = getNoise(uv, t);
  float d = getDepth(noise);

  //calc HSV color
  float h = 0.5;// + (d * 0.3); //= d + 0.2; //rainbow hue
  float s = 0.;
  float v = 0.; //deeper is darker

  //get depth at offset position (needed for outlining)
  // float noiseOffY = getNoise(uv + vec2(0, LINE_WIDTH), t);
  // float noiseOffX = getNoise(uv + vec2(LINE_WIDTH, 0), t);
  // float dOffY = getDepth(noiseOffY);
  // float dOffX = getDepth(noiseOffX);

  float WIDEN = 1. + (sin(t)+1.)/2. * 1.5;
  const int STEPS = 15;
  for (int j=0; j<STEPS; j++){
    vec2 dOffset = vec2(
      getDepth(getNoise(uv + vec2(0, LINE_WIDTH) * WIDEN * pow(float(j), 1.25), t)),
      getDepth(getNoise(uv + vec2(0, -LINE_WIDTH) * WIDEN * pow(float(j), 1.25), t))
    );


    // // Save for later
    // vec4 dOffset = vec4(
    //   getDepth(getNoise(uv + vec2(LINE_WIDTH, 0) * WIDEN * pow(float(j), 1.25), t)),
    //   getDepth(getNoise(uv + vec2(0, LINE_WIDTH) * WIDEN * pow(float(j), 1.25), t)),
    //   getDepth(getNoise(uv + vec2(-LINE_WIDTH, 0) * WIDEN * pow(float(j), 1.25), t)),
    //   getDepth(getNoise(uv + vec2(0, -LINE_WIDTH) * WIDEN * pow(float(j), 1.25), t))
    // );

    if (d != dOffset.x || d != dOffset.y){
    //if (d != dOffset.x || d != dOffset.y || d != dOffset.z || d != dOffset.w){ // Save for later
      h = 0.; //(uv.x * 0.1) + 0.5;
      s = 0.;
      v += 0.15 * floor( snoise( vec2(uv.x + t/50. + posX/50., uv.y ) * 512.) + (0.25 * float(STEPS)/float(j+1)) );
      if (d != dOffset.x){
        v *= 0.85;
      }
    }
  }

  // // Outline ridges
  // if (d != dOffY || d != dOffX){
  //   h = (d * 0.1) + (sin(t) + 1.)/2.;
  //   s = .3;
  //   v = (sin(t)+1.)/2. + d + 0.5;
  //   //v *= 0.25;
  // }

  col = hsv2rgb(vec3(h,s,v));

  //add vertical gradient
  //col *= 0.2 + (gl_FragCoord.y/u_resolution.y) * 0.8;

  //add noise texture -- figure out a way to do this without shadertoy!
  col += staticNoise;

  gl_FragColor = vec4(col, 1.0);
}
`;

// get mouse position for GL uniform
function getRelativeMousePosition(event, target) {
  target = target || event.target;
  var rect = target.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

// assumes target or event.target is canvas
function getNoPaddingNoBorderCanvasRelativeMousePosition(event, target) {
  target = target || event.target;
  var pos = getRelativeMousePosition(event, target);

  pos.x = pos.x * target.width  / target.clientWidth;
  pos.y = pos.y * target.height / target.clientHeight;

  return pos;
}


// init webgl
let mousePos = {x: 0, y: 0};
const gl = document.getElementById("c").getContext("webgl");
const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

const arrays = {
  position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
};

const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
const textures = twgl.createTextures(gl, {
  noise: { src: "js/noise.png", mag: gl.NEAREST },
  terrain: { src: "js/terrain.png" }
});

function render(time) {
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);



  const uniforms = {
    u_time: time * 0.001,
    u_resolution: [gl.canvas.width, gl.canvas.height],
    u_mouse: [mousePos.x, mousePos.y],
    u_texture: textures.noise,
    u_terrain: textures.terrain
  };

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, bufferInfo);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// attach listener
window.addEventListener('mousemove', e => {
  const pos = getNoPaddingNoBorderCanvasRelativeMousePosition(e, gl.canvas);

  // pos is in pixel coordinates for the canvas.
  // so convert to WebGL clip space coordinates
  const x = pos.x / gl.canvas.width  *  2 - 1;
  const y = pos.y / gl.canvas.height * -2 + 1;

  mousePos.x = x;
  mousePos.y = y;
});
