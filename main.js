let gl; 
let logoAntes = 0;
let minhaTextura = null; 

function mouseMexeu(evento) {}
function mouseClicou(evento) {}
function teclaPressionada(evento) {}

window.onload = () => {
  gl = configuraTudo();
  if (gl) {
    requestAnimationFrame(loopPrincipal);
  }
};

function loopPrincipal(agora) {
  const quantoPassou = (agora - logoAntes) / 1000;
  logoAntes = agora;
  
  atualizaLogica(quantoPassou);
  desenhaCena(gl);

  requestAnimationFrame(loopPrincipal);
}

function configuraTudo() {
  const canvas = document.getElementById('gameCanvas');
  const glContext = canvas.getContext('webgl2');

  if (!glContext) {
      console.error("WebGL 2 não é suportado pelo seu navegador.");
      return null;
  }

  canvas.addEventListener('mousemove', mouseMexeu);
  canvas.addEventListener('click', mouseClicou);
  document.addEventListener('keydown', teclaPressionada);
  
  // 3. SHADERS ATUALIZADOS PARA SUPORTAR TEXTURAS
  const vertexShaderSource = `#version 300 es
in vec2 a_posicao;
in vec2 a_coordsTex;     // Coordenadas UV vindas do JS
out vec2 v_coordsTex;    // Passa para o Fragment Shader

void main() {
  gl_Position = vec4(a_posicao, 0.0, 1.0); 
  v_coordsTex = a_coordsTex;
}`;

  const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_coordsTex;
uniform sampler2D u_textura; // A imagem enviada pelo JS
out vec4 corFinal;

void main() {
  // Pega a cor exata do pixel da imagem correspondente a esta coordenada
  corFinal = texture(u_textura, v_coordsTex); 
}`;

  const vertexShader = glContext.createShader(glContext.VERTEX_SHADER);
  glContext.shaderSource(vertexShader, vertexShaderSource);
  glContext.compileShader(vertexShader);

  const fragmentShader = glContext.createShader(glContext.FRAGMENT_SHADER);
  glContext.shaderSource(fragmentShader, fragmentShaderSource);
  glContext.compileShader(fragmentShader);

  const programa = glContext.createProgram();
  glContext.attachShader(programa, vertexShader);
  glContext.attachShader(programa, fragmentShader);
  glContext.linkProgram(programa);

  // 4. ESPECIFICA A CENA (Geometria + Coordenadas UV)
  const posicoes = new Float32Array([
    -0.2,  0.2,  // Topo-Esquerdo
    -0.2, -0.2,  // Base-Esquerdo
     0.2, -0.2,  // Base-Direito
    
    -0.2,  0.2,  // Topo-Esquerdo
     0.2, -0.2,  // Base-Direito
     0.2,  0.2   // Topo-Direito
  ]);

  // Coordenadas de Textura (UV): variam de 0.0 a 1.0
  const coordsTex = new Float32Array([
    0.0, 1.0,  // Topo-Esquerdo
    0.0, 0.0,  // Base-Esquerdo
    1.0, 0.0,  // Base-Direito
    0.0, 1.0,  // Topo-Esquerdo
    1.0, 0.0,  // Base-Direito
    1.0, 1.0   // Topo-Direito
  ]);

  const vao = glContext.createVertexArray();
  glContext.bindVertexArray(vao);

  // Configura Buffer de Posições
  const vboPos = glContext.createBuffer();
  glContext.bindBuffer(glContext.ARRAY_BUFFER, vboPos);
  glContext.bufferData(glContext.ARRAY_BUFFER, posicoes, glContext.STATIC_DRAW);
  const localPosicao = glContext.getAttribLocation(programa, "a_posicao");
  glContext.enableVertexAttribArray(localPosicao);
  glContext.vertexAttribPointer(localPosicao, 2, glContext.FLOAT, false, 0, 0);

  // Configura Buffer de Coordenadas de Textura (UV)
  const vboTex = glContext.createBuffer();
  glContext.bindBuffer(glContext.ARRAY_BUFFER, vboTex);
  glContext.bufferData(glContext.ARRAY_BUFFER, coordsTex, glContext.STATIC_DRAW);
  const localTex = glContext.getAttribLocation(programa, "a_coordsTex");
  glContext.enableVertexAttribArray(localTex);
  glContext.vertexAttribPointer(localTex, 2, glContext.FLOAT, false, 0, 0);

  // CARREGAR A IMAGEM NO JAVASCRIPT E ENVIAR PARA A GPU
  minhaTextura = glContext.createTexture();
  glContext.bindTexture(glContext.TEXTURE_2D, minhaTextura);

  // Coloca provisoriamente um pixel azul enquanto a imagem real não carrega
  glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, 1, 1, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

  const imagem = new Image();
  imagem.src = 'assets/soldier.png'; 
  imagem.onload = function() {
    
    // deixa transparente o fundo da imagem
      glContext.enable(glContext.BLEND);
      glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);
      glContext.bindTexture(glContext.TEXTURE_2D, minhaTextura);
      glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);
      // Envia os pixels da imagem HTML para o objeto de textura do WebGL
      glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, imagem);
      
      // Como imagens da Web geralmente seguem padrões de tamanho variados, geramos os Mipmaps
      glContext.generateMipmap(glContext.TEXTURE_2D);
  };

  // 5. Inicia valores de estado
  glContext.clearColor(0.2, 0.2, 0.2, 1); 
  glContext.useProgram(programa);         
  glContext.bindVertexArray(vao);         

  return glContext;
}

function atualizaLogica(quantoTempo) {
  // Lógica de jogo
}

function desenhaCena(gl) {
  if (!gl) return; 

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Ativa a unidade de textura 0 e desenha
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, minhaTextura);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}