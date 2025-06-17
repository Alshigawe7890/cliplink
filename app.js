let pc, dc;

function setupDataChannel() {
  dc.onopen = () => document.getElementById('roomArea').style.display='block';
  dc.onmessage = e => {
    try {
      const obj = JSON.parse(e.data);
      if (obj.type==='text') showMessage(obj.data);
      if (obj.type==='file') showFile(obj.name, obj.data);
    } catch {
      showMessage(e.data);
    }
  };
}

function showMessage(txt) {
  const li = document.createElement('li');
  li.textContent = txt;
  document.getElementById('messages').appendChild(li);
}

function showFile(name, dataURL) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = dataURL; a.download = name;
  a.textContent = `⬇️ ${name}`;
  li.appendChild(a);
  document.getElementById('files').appendChild(li);
}

async function setupConnection(isOfferer) {
  pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  pc.onicecandidate = e => e.candidate && sessionStore.send({candidate:e.candidate});
  pc.ondatachannel = e => { dc = e.channel; setupDataChannel(); };

  if (isOfferer) {
    dc = pc.createDataChannel('chan'); setupDataChannel();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sessionStore.send({ offer });
  }
}

async function handleSignal(msg) {
  if (msg.offer) {
    await setupConnection(false);
    await pc.setRemoteDescription(msg.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sessionStore.send({ answer });
  } else if (msg.answer) {
    await pc.setRemoteDescription(msg.answer);
  } else if (msg.candidate) {
    await pc.addIceCandidate(msg.candidate);
  }
}

const sessionStore = {
  key: '',
  send(msg) { localStorage.setItem(this.key, JSON.stringify(msg)); },
  watch(callback) {
    window.addEventListener('storage', e => {
      if (e.key === this.key) callback(JSON.parse(e.newValue));
    });
  }
};

document.getElementById('createRoom').onclick = () => {
  const code = Date.now().toString().slice(-6);
  document.getElementById('roomCode').textContent = code;
  sessionStore.key = 'cliplink-'+code;
  sessionStore.watch(handleSignal);
  setupConnection(true);
};

document.getElementById('joinRoom').onclick = () => {
  const code = document.getElementById('roomInput').value.trim();
  document.getElementById('roomCode').textContent = code;
  sessionStore.key = 'cliplink-'+code;
  sessionStore.watch(handleSignal);
  setupConnection(false);
};

document.getElementById('sendText').onclick = () => {
  const txt = document.getElementById('textInput').value;
  if (dc && dc.readyState==='open') {
    const obj = JSON.stringify({type:'text',data:txt});
    dc.send(obj);
    showMessage('أنا: '+txt);
  }
};

document.getElementById('fileInput').onchange = async () => {
  const f = document.getElementById('fileInput').files[0];
  if (!f || !dc || dc.readyState!=='open') return;
  const reader = new FileReader();
  reader.onload = () => {
    const obj = JSON.stringify({type:'file', name:f.name, data:reader.result});
    dc.send(obj);
    showFile(f.name, reader.result);
  };
  reader.readAsDataURL(f);
};
