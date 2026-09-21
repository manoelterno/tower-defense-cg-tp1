let gl; 
let logoAntes = 0;
let texFundo = null;
let texTorre = null;
let texInimigo = null;
let localDeslocamento = null;
let localEscala = null;

// Variáveis de estado do jogo
const torre = {
  x: 0.0,
  y: 0.0
};
const inimigos = [];
let tempoParaSpawn = 0;

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
  
  // 3. SHADERS ATUALIZADOS PARA SUPORTAR TEXTURAS E TRANSFORMAÇÕES
  const vertexShaderSource = `#version 300 es
in vec2 a_posicao;
in vec2 a_coordsTex;     // Coordenadas UV vindas do JS

uniform vec2 u_deslocamento;
uniform vec2 u_escala;

out vec2 v_coordsTex;    // Passa para o Fragment Shader

void main() {
  vec2 posicaoFinal = (a_posicao * u_escala) + u_deslocamento;
  gl_Position = vec4(posicaoFinal, 0.0, 1.0); 
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

  // Resgata a localização dos Uniforms para translação e escala
  localDeslocamento = glContext.getUniformLocation(programa, "u_deslocamento");
  localEscala = glContext.getUniformLocation(programa, "u_escala");

  // CARREGAR AS TEXTURAS USANDO A FUNÇÃO UTILITÁRIA
  texFundo = carregarTextura(glContext, 'assets/fundo.png');
  texTorre = carregarTextura(glContext, 'assets/torre.png');
  texInimigo = carregarTextura(glContext, 'assets/soldier.png');

  // 5. Inicia valores de estado
  glContext.clearColor(0.2, 0.2, 0.2, 1); 
  glContext.useProgram(programa);         
  glContext.bindVertexArray(vao);         

  // Define valores iniciais padrão para não distorcer ou zerar a geometria
  glContext.uniform2f(localDeslocamento, 0.0, 0.0);
  glContext.uniform2f(localEscala, 1.0, 1.0);

  return glContext;
}

function carregarTextura(gl, url) {
  const textura = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textura);

  // Coloca provisoriamente um pixel azul enquanto a imagem real não carrega
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255])
  );

  const imagem = new Image();
  imagem.onload = function() {
    // Configurações de transparência (BLEND)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Inversão do eixo Y para coincidir com as coordenadas UV do WebGL
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Envia os pixels da imagem para o objeto de textura na GPU
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagem);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  imagem.onerror = function() {
    console.warn(`Não foi possível carregar a imagem da textura em: ${url}`);
  };
  imagem.src = url;

  return textura;
}

function atualizaLogica(quantoPassou) {
  // 1. Spawner de inimigos nas bordas da tela a cada 2 segundos
  tempoParaSpawn += quantoPassou;
  if (tempoParaSpawn >= 2.0) {
    tempoParaSpawn -= 2.0;

    let x = 0;
    let y = 0;
    const borda = Math.floor(Math.random() * 4);

    switch (borda) {
      case 0: // Borda Superior
        x = Math.random() * 2.0 - 1.0;
        y = 1.1;
        break;
      case 1: // Borda Inferior
        x = Math.random() * 2.0 - 1.0;
        y = -1.1;
        break;
      case 2: // Borda Esquerda
        x = -1.1;
        y = Math.random() * 2.0 - 1.0;
        break;
      case 3: // Borda Direita
        x = 1.1;
        y = Math.random() * 2.0 - 1.0;
        break;
    }

    inimigos.push({
      x: x,
      y: y,
      velocidade: 0.3 // Velocidade em unidades NDC por segundo
    });
  }

  // 2. Movimentação vetorial dos inimigos em direção à torre (0, 0)
  for (let i = 0; i < inimigos.length; i++) {
    const inimigo = inimigos[i];

    // Vetor direção do inimigo até a torre
    const dx = torre.x - inimigo.x;
    const dy = torre.y - inimigo.y;

    // Distância euclidiana (módulo do vetor)
    const distancia = Math.hypot(dx, dy);

    // Normalização do vetor (apenas se não estiver já na torre)
    if (distancia > 0.001) {
      const dirX = dx / distancia;
      const dirY = dy / distancia;

      // Deslocamento proporcional à velocidade e ao tempo decorrido
      inimigo.x += dirX * inimigo.velocidade * quantoPassou;
      inimigo.y += dirY * inimigo.velocidade * quantoPassou;
    }
  }
}

function desenhaCena(gl) {
  if (!gl) return; 

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);

  // 1) O Fundo (posicionado no centro com escala para cobrir a tela de -1 a 1)
  gl.bindTexture(gl.TEXTURE_2D, texFundo);
  gl.uniform2f(localDeslocamento, 0.0, 0.0);
  gl.uniform2f(localEscala, 5.0, 5.0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // 2) A Torre (posicionada no centro)
  gl.bindTexture(gl.TEXTURE_2D, texTorre);
  gl.uniform2f(localDeslocamento, torre.x, torre.y);
  gl.uniform2f(localEscala, 1.0, 1.0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // 3) Todos os inimigos do array
  gl.bindTexture(gl.TEXTURE_2D, texInimigo);
  for (let i = 0; i < inimigos.length; i++) {
    const inimigo = inimigos[i];
    gl.uniform2f(localDeslocamento, inimigo.x, inimigo.y);
    gl.uniform2f(localEscala, 0.5, 0.5);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}