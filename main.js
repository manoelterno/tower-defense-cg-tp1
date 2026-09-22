let gl; 
let logoAntes = 0;
let texFundo = null;
let texTorre = null;
let texInimigo = null;
let texInimigoTop = null;
let texInimigoMorte = null;
let texInimigoMorteDown = null;
let texProjetil = null;
let localDeslocamento = null;
let localEscala = null;
let localRotacao = null;
let tempoParaSpawn = 0;
let tempoParaTiro = 0;
let pontuacao = 0;
let vida = 100;
let gameOver = false;
let musicaFundo = null;

let texBomba = null;
let tempoParaBomba = 0;
// Variáveis de estado do jogo
const torre = {
  x: 0.0,
  y: 0.0
};
const inimigos = [];
const projeteis = [];
const bombas = [];


function mouseMexeu(evento) {}

function pontuacaoAtualizada(valor) {
  pontuacao = pontuacao + valor;
  const elementoPontuacao = document.getElementById('score-display');
  if (elementoPontuacao) {
    elementoPontuacao.textContent = `Pontuação: ${pontuacao}`;
  }
}

function vidaAtualizada() {
  vida = Math.max(0, vida - 10);

  const elementoVida = document.getElementById('hp-display');
  if (elementoVida) {
    elementoVida.textContent = `Torre HP: ${vida}`;
  }

  if (vida <= 0) {
    gameOver = true;
    const overlay = document.getElementById('game-over');
    if (overlay) overlay.classList.remove('hidden');
  }
}

function audioTiro() {
  const som = new Audio('assets/audio/tiro.wav');
  som.volume = 0.6;
  som.play();
}

function audioExplosao() {
  const som = new Audio('assets/audio/explosao.wav');
  som.volume = 0.7;
  som.play();
}

function iniciarMusicaFundo() {
  if (musicaFundo) return;

  musicaFundo = new Audio('assets/audio/soundtrack.ogg');
  musicaFundo.loop = true;
  musicaFundo.volume = 0.5;

  musicaFundo.play().catch(() => {
    console.log('A reprodução da música precisa começar após um clique do usuário.');
  });
}

function mouseClicou(evento) {
  iniciarMusicaFundo();

  const canvas = document.getElementById('gameCanvas') || evento.target;
  const rect = canvas.getBoundingClientRect();

  // 1. Coordenadas do clique relativas ao Canvas (espaço de tela em pixels: [0, 0] no topo-esquerdo)
  const pixelX = evento.clientX - rect.left;
  const pixelY = evento.clientY - rect.top;

  // 2. Conversão para NDC WebGL:
  // Eixo X: [0, rect.width]  -> [-1, 1]
  // Eixo Y: [0, rect.height] -> [1, -1] (inverte o eixo Y pois no WebGL +1 é o topo e -1 é a base)
  const ndcX = (pixelX / rect.width) * 2.0 - 1.0;
  const ndcY = 1.0 - (pixelY / rect.height) * 2.0;

  //2.5 Verifica colisão com bombas: se o clique estiver dentro do raio de uma bomba, explode a bomba e mata todos os inimigos
  for (let i = bombas.length - 1; i >= 0; i--) {
    const bomba = bombas[i];
    const dx = ndcX - bomba.x;
    const dy = ndcY - bomba.y;
    const dist = Math.hypot(dx, dy);

    if (dist < bomba.raio + 0.08) {
      let totalMortos = 0;
      // Explode a bomba
      for (let j = 0; j < inimigos.length; j++) {
        const inimigo = inimigos[j];
        if (!inimigo.morto) {
          inimigo.morto = true;
          inimigo.tempoMorte = 0.5;
          totalMortos++;
        }
      }

      pontuacaoAtualizada(totalMortos * 50); // Atualiza a pontuação ao explodir a bomba
      bombas.splice(i, 1);
      audioExplosao();
      return;
    }
  }

  // 3. Disparo manual do jogador: cria um projétil que sai da torre em direção ao ponto clicado
  const dx = ndcX - torre.x;
  const dy = ndcY - torre.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 0.001) {
    projeteis.push({
      x: torre.x,
      y: torre.y,
      dirX: dx / dist,
      dirY: dy / dist,
      velocidade: 1,
      angulo: Math.atan2(dy, dx) // calcula o ângulo em radianos apontando para o mouse
    });
    audioTiro();
  }
}

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
in vec2 a_coordsTex;     

uniform vec2 u_deslocamento;
uniform vec2 u_escala;
uniform float u_rotacao; // Novo uniform para o ângulo

out vec2 v_coordsTex;    

void main() {
  // 1. Aplica a escala
  vec2 pos = a_posicao * u_escala;
  
  // 2. Calcula seno e cosseno do ângulo
  float c = cos(u_rotacao);
  float s = sin(u_rotacao);
  
  // 3. Aplica a rotação
  vec2 posRotacionada = vec2(
    pos.x * c - pos.y * s,
    pos.x * s + pos.y * c
  );

  // 4. Aplica o deslocamento final
  vec2 posicaoFinal = posRotacionada + u_deslocamento;
  
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
  localRotacao = glContext.getUniformLocation(programa, "u_rotacao"); 

  // CARREGAR AS TEXTURAS USANDO A FUNÇÃO UTILITÁRIA
  texFundo = carregarTextura(glContext, 'assets/fundo.png');
  texTorre = carregarTextura(glContext, 'assets/torre.png');
  texInimigo = carregarTextura(glContext, 'assets/soldier.png');
  texInimigoTop = carregarTextura(glContext, 'assets/soldier_top.png');
  texInimigoMorte = carregarTextura(glContext, 'assets/soldier_die.png');
  texInimigoMorteDown = carregarTextura(glContext, 'assets/soldier_die_down.png');
  texProjetil = carregarTextura(glContext, 'assets/projetil.png');
  texBomba = carregarTextura(glContext, 'assets/bomb.png');

  // 5. Inicia valores de estado
  glContext.clearColor(0.2, 0.2, 0.2, 1); 
  glContext.useProgram(programa);         
  glContext.bindVertexArray(vao);         

  // Define valores iniciais padrão para não distorcer ou zerar a geometria
  glContext.uniform2f(localDeslocamento, 0.0, 0.0);
  glContext.uniform2f(localEscala, 1.0, 1.0);
  glContext.uniform1f(localRotacao, 0.0); // Inicializa a rotação como 0 para seguir click
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
  if (gameOver) return;

  // 1. Spawner de inimigos nas bordas da tela a cada 2 segundos
  tempoParaSpawn += quantoPassou;
  tempoParaBomba += quantoPassou;

  if (tempoParaSpawn >= 0.5) {
    tempoParaSpawn -= 0.5;

    let x = 0;
    let y = 0;
    let tipo = 'esquerda';
    const borda = Math.floor(Math.random() * 4);

    switch (borda) {
      case 0: // Centro da Borda Superior (descendo para a torre)
        x = 0.0;
        y = 1.1;
        tipo = 'topo';
        break;
      case 1: // Centro da Borda Inferior (subindo para a torre)
        x = 0.0;
        y = -1.1;
        tipo = 'baixo';
        break;
      case 2: // Centro da Borda Esquerda (indo da esquerda para a torre)
        x = -1.1;
        y = 0.0;
        tipo = 'esquerda';
        break;
      case 3: // Centro da Borda Direita (indo da direita para a torre)
        x = 1.1;
        y = 0.0;
        tipo = 'direita';
        break;
    }

    inimigos.push({
      x: x,
      y: y,
      tipo: tipo,
      velocidade: 0.3 // Velocidade em unidades NDC por segundo
    });
  }

  if (tempoParaBomba >= 1.0) {
    tempoParaBomba = 0.0;

    // 10% de chance por segundo
    if (Math.random() < 0.10) {
      const x = (Math.random() * 1.8) - 0.9; // entre -0.9 e 0.9
      const y = (Math.random() * 1.8) - 0.9;

      bombas.push({
        x,
        y,
        raio: 0.12
      });
    }
  }

  for (let i = bombas.length - 1; i >= 0; i--) {
    bombas[i].tempoVida = (bombas[i].tempoVida || 0) + quantoPassou;
    if (bombas[i].tempoVida > 6.0) {
      bombas.splice(i, 1);
    }
  }

  // 2. Movimentação vetorial dos inimigos em direção à torre
  for (let i = 0; i < inimigos.length; i++) {
    const inimigo = inimigos[i];
    if (inimigo.morto) continue;

    let bloqueado = false;

    for (let j = 0; j < inimigos.length; j++) {
      const outro = inimigos[j];
      if (!outro.morto) continue;

      const dx = outro.x - inimigo.x;
      const dy = outro.y - inimigo.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 0.18) {
        bloqueado = true;
        break;
      }
    }

    if (bloqueado) continue;

    const dx = torre.x - inimigo.x;
    const dy = torre.y - inimigo.y;
    const distancia = Math.hypot(dx, dy);

    if (distancia > 0.001) {
      const dirX = dx / distancia;
      const dirY = dy / distancia;

      inimigo.x += dirX * inimigo.velocidade * quantoPassou;
      inimigo.y += dirY * inimigo.velocidade * quantoPassou;
    }
  }

// 2.5 Verifica colisão entre inimigos e torre, aplicando dano à torre se necessário
  for (let i = inimigos.length - 1; i >= 0; i--) {
    const inimigo = inimigos[i];

    if (inimigo.morto) continue;

    const dx = inimigo.x - torre.x;
    const dy = inimigo.y - torre.y;
    const distancia = Math.hypot(dx, dy);

    // ajuste esse valor conforme o tamanho visual da torre/inimigo
    if (distancia < 0.15) {
      inimigos.splice(i, 1); // remove o inimigo ao encostar na torre
      vidaAtualizada();       // chama a função de dano
      break;                 // evita repetir o dano no mesmo frame
    }
  }

  // 3. Atualização da posição de cada projétil no espaço
  for (let i = projeteis.length - 1; i >= 0; i--) {
    const p = projeteis[i];
    p.x += p.dirX * p.velocidade * quantoPassou;
    p.y += p.dirY * p.velocidade * quantoPassou;

    // Descarta projéteis que saíram dos limites da tela visível
    if (Math.abs(p.x) > 1.5 || Math.abs(p.y) > 1.5) {
      projeteis.splice(i, 1);
      continue;
    }

    // Detecção de colisão em formato de círculo (raio de colisão < 0.1)
    for (let j = inimigos.length - 1; j >= 0; j--) {
      const inimigo = inimigos[j];
      if (inimigo.morto) continue; // Não atinge inimigos que já estão morrendo

      const distancia = Math.hypot(p.x - inimigo.x, p.y - inimigo.y);

      if (distancia < 0.1) {
        // Colisão detectada: remove o projétil

        projeteis.splice(i, 1);

        // Marca o inimigo como morto e inicia o tempo de 1 segundo deitado
        inimigo.morto = true;
        inimigo.tempoMorte = 1.0;
        pontuacaoAtualizada(50); // Atualiza a pontuação ao abater um inimigo
        break; // O projétil foi destruído, encerra a busca para este projétil
      }
    }
  }

  // 4. Temporizador de desaparecimento dos inimigos mortos (1 segundo deitado)
  for (let i = inimigos.length - 1; i >= 0; i--) {
    const inimigo = inimigos[i];
    if (inimigo.morto) {
      inimigo.tempoMorte -= quantoPassou;
      if (inimigo.tempoMorte <= 0) {
        inimigos.splice(i, 1);
      }
    }
  }
}

function desenhaCena(gl) {
  if (!gl) return; 

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);

  gl.uniform1f(localRotacao, 0.0);

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

  // 3) Todos os inimigos do array (vivos ou deitados/mortos)
  for (let i = 0; i < inimigos.length; i++) {
    const inimigo = inimigos[i];
    let tex = texInimigo;
    let escalaX = 0.5;
    let escalaY = 0.5;

    if (inimigo.morto) {
      // Configuração para o inimigo deitado após tomar o projétil
      switch (inimigo.tipo) {
        case 'direita':
          // Inimigo que vem da borda direita: soldier_die.png
          tex = texInimigoMorte;
          escalaX = 0.5;
          escalaY = 0.5;
          break;
        case 'esquerda':
          // Inimigo que vem da borda esquerda: soldier_die.png invertido horizontalmente
          tex = texInimigoMorte;
          escalaX = -0.5;
          escalaY = 0.5;
          break;
        case 'baixo':
          // Inimigo que vem da borda de baixo: soldier_die_down.png
          tex = texInimigoMorteDown;
          escalaX = 0.5;
          escalaY = 0.5;
          break;
        case 'topo':
          // Inimigo que vem da borda de cima: soldier_die_down.png invertido verticalmente
          tex = texInimigoMorteDown;
          escalaX = 0.5;
          escalaY = -0.5;
          break;
      }
    } else {
      // Configuração para o inimigo vivo marchando em direção à torre
      switch (inimigo.tipo) {
        case 'direita':
          // Da direita para a torre: soldier.png invertido horizontalmente
          tex = texInimigo;
          escalaX = -0.5;
          escalaY = 0.5;
          break;
        case 'topo':
          // De cima para a torre: soldier_top.png normal
          tex = texInimigoTop;
          escalaX = 0.5;
          escalaY = 0.5;
          break;
        case 'baixo':
          // De baixo para a torre: soldier_top.png invertido verticalmente
          tex = texInimigoTop;
          escalaX = 0.5;
          escalaY = -0.5;
          break;
        case 'esquerda':
        default:
          // Da esquerda para a torre: soldier.png normal
          tex = texInimigo;
          escalaX = 0.5;
          escalaY = 0.5;
          break;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform2f(localDeslocamento, inimigo.x, inimigo.y);
    gl.uniform2f(localEscala, escalaX, escalaY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  //3.5) Bombas (posicionadas aleatoriamente na tela)
  gl.bindTexture(gl.TEXTURE_2D, texBomba);
  for (let i = 0; i < bombas.length; i++) {
    const bomba = bombas[i];
    gl.uniform2f(localDeslocamento, bomba.x, bomba.y);
    gl.uniform2f(localEscala, 0.3, 0.3);
    gl.uniform1f(localRotacao, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  // 4) Todos os projéteis do array
  gl.bindTexture(gl.TEXTURE_2D, texProjetil);
  for (let i = 0; i < projeteis.length; i++) {
    const projetil = projeteis[i];
    gl.uniform2f(localDeslocamento, projetil.x, projetil.y);
    gl.uniform2f(localEscala, 0.2, 0.2);
    gl.uniform1f(localRotacao, projetil.angulo); 
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.uniform1f(localRotacao, 0.0);
}