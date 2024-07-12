'use strict';

function createPipelineStageProgram(
  gl,
  vertexShader,
  fragmentShader,
  positionBuffer,
  texCoordBuffer
) {
  const program = createProgram(
    gl,
    vertexShader,
    fragmentShader
  );
  const positionAttributeLocation = gl.getAttribLocation(
    program,
    'a_position'
  );
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(
    positionAttributeLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );
  const texCoordAttributeLocation = gl.getAttribLocation(
    program,
    'a_texCoord'
  );
  gl.enableVertexAttribArray(texCoordAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.vertexAttribPointer(
    texCoordAttributeLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );
  return program;
}

function createProgram(
  gl,
  vertexShader,
  fragmentShader
) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Could not link WebGL program: ${gl.getProgramInfoLog(program)}`
    );
  }
  return program;
}

function compileShader(
  gl,
  shaderType,
  shaderSource
) {
  const shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      `Could not compile shader: ${gl.getShaderInfoLog(shader)}`
    );
  }
  return shader;
}

function createTexture(
  gl,
  internalformat,
  width,
  height,
  minFilter = gl.NEAREST,
  magFilter = gl.NEAREST
) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_S,
    gl.CLAMP_TO_EDGE
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_T,
    gl.CLAMP_TO_EDGE
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    minFilter
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    magFilter
  );
  gl.texStorage2D(
    gl.TEXTURE_2D,
    1,
    internalformat,
    width,
    height
  );
  return texture;
}

function initBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(data),
    gl.STATIC_DRAW,
  );
  return buffer;
}

exports.createPipelineStageProgram = createPipelineStageProgram;
exports.createProgram = createProgram;
exports.createTexture = createTexture;
exports.compileShader = compileShader;
exports.initBuffer = initBuffer;
