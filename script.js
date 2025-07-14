document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('message', e => {
  // añade esta línea:
  console.log('[Wheel] mensaje recibido:', e.data);
  if (e.data.type === 'donation' || e.data.type === 'order.success') {
    …
  }
});
  const wheel         = document.getElementById('wheel');
  const container     = document.getElementById('container');
  const chosenNumber  = document.getElementById('chosenNumber');
  const resultNumber  = document.getElementById('resultNumber');
  const resultMessage = document.getElementById('resultMessage');

  const totalSegments = 77;
  const segmentSize   = 360 / totalSegments;
  let currentRotation = 0;
  let isSpinning      = false;
  const donationQueue = [];

  // Loop pasivo desde el arranque
  wheel.classList.add('loop');

  // Escucha alertas de Ko-fi (overlay.js)
  window.addEventListener('message', e => {
    // —— Depuración visual ——
    const dbg = document.getElementById('debug');
    if (dbg) dbg.textContent = JSON.stringify(e.data, null, 2);
    // —— Fin depuración ——

    // Aceptar tanto donaciones reales como test alerts de Ko-fi
    if (e.data.type === 'donation' || e.data.type === 'order.success') {
      let amt    = parseFloat(e.data.amount);
      let msg    = e.data.message || '';
      let choice = parseChoice(msg);

      // —— NUEVO BLOQUE —— 
      // Si no hay número en el mensaje, fijamos ALWAYS sector 77 (índice 76) y 1 spin
      if (choice == null) {
        choice = 76;   // índice 76 = número 77
        amt    = 1;    // fuerza un solo spin
      }
      // —— FIN NUEVO BLOQUE —— 

      if (isSpinning) {
        donationQueue.push({ amount: amt, idx: choice });
      } else {
        multiSpin(amt, choice);
      }
    }
  });

  function parseChoice(msg) {
    const m = msg.match(/\b([1-9][0-9]?)\b/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return (n >= 1 && n <= totalSegments) ? n - 1 : null;
  }

  // Ejecuta N paradas repartidas en 15s, luego 7s de resultado
  async function multiSpin(amount, targetIdx) {
    isSpinning = true;
    wheel.classList.remove('loop');
    container.classList.remove('special10','legendary');
    chosenNumber.classList.remove('legendary','win','lose');
    wheel.style.transition = 'none';

    // Efectos según tier
    if      (amount === 10) {
      container.classList.add('special10');
    } else if (amount >= 100) {
      container.classList.add('legendary');
      chosenNumber.classList.add('legendary');
    }

    // Picks y tiempos
    const picks     = amount === 10   ? 5
                     : amount >= 100 ? 50
                     : 1;
    const totalTime = 15000;  // 15 s
    const showTime  = 7000;   // 7 s
    const perSpin   = totalTime / picks;

    // Muestra elección desde el inicio
    resultNumber.textContent  = (targetIdx != null ? targetIdx+1 : '?');
    chosenNumber.style.display = 'block';
    chosenNumber.classList.remove('win','lose');
    resultMessage.textContent = '';

    let anyWin = false;
    for (let i = 0; i < picks; i++) {
      // Cada parada: ángulo aleatorio
      const stopDeg = Math.random() * 360;
      const landed  = await spinOnce(perSpin, stopDeg);
      if (targetIdx != null && landed === targetIdx) {
        anyWin = true;
      }
    }

    // Marca resultado y mensaje
    chosenNumber.classList.add(anyWin ? 'win' : 'lose');
    resultMessage.textContent = anyWin
      ? "You're very lucky today!"
      : "Too bad, no luck today!";

    // Tras showTime, reset y procesa cola
    setTimeout(() => {
      chosenNumber.style.display = 'none';
      container.classList.remove('special10','legendary');
      chosenNumber.classList.remove('legendary','win','lose');
      wheel.style.transition = 'none';
      wheel.classList.add('loop');
      isSpinning = false;
      if (donationQueue.length) {
        const next = donationQueue.shift();
        multiSpin(next.amount, next.idx);
      }
    }, showTime);
  }

  // Gira 2 vueltas + stopDeg en durationMs, resuelve con índice aterrizado
  function spinOnce(durationMs, stopDeg) {
    return new Promise(res => {
      wheel.classList.remove('loop');
      wheel.style.transition = 'none';

      const rounds = 2;
      let spinDeg = rounds*360 + stopDeg;
      if ((currentRotation % 360) === (spinDeg % 360)) spinDeg += 0.1;

      // Forzar reflow
      wheel.getBoundingClientRect();

      currentRotation = (currentRotation + spinDeg) % 360;
      wheel.style.transition = `transform ${durationMs/1000}s ease-out`;
      wheel.style.transform  = `translate(-50%,-50%) rotate(${currentRotation}deg)`;

      const onEnd = () => {
        wheel.removeEventListener('transitionend', onEnd);
        // Alineamos el “sector 0” con la flecha (flecha en 225°)
        const landedDeg = (360 - (currentRotation % 360) + 225) % 360;
        const idx       = Math.floor(landedDeg / segmentSize);
        res(idx);
      };
      wheel.addEventListener('transitionend', onEnd);
    });
  }
});
