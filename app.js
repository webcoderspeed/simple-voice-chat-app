// Elements
const roomInput = document.getElementById('roomInput');
const joinRoomButton = document.getElementById('joinRoomButton');
const startCallButton = document.getElementById('startCallButton');
const endCallButton = document.getElementById('endCallButton');
const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');

let localStream;
let remoteStream;
let peerConnection;
let roomName;

const servers = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		// You can add more STUN/TURN servers here
	],
};

// WebSocket signaling
const signalingServerUrl = 'wss://simple-voice-chat-app.onrender.com';
const signalingSocket = new WebSocket(signalingServerUrl);

signalingSocket.onmessage = (message) => {
	const data = JSON.parse(message.data);
	handleMessage(data.type, data.payload);
};

function sendMessage(type, payload) {
	const message = JSON.stringify({ type, payload, room: roomName });
	signalingSocket.send(message);
}

joinRoomButton.onclick = () => {
	roomName = roomInput.value;
	if (roomName) {
		joinRoomButton.disabled = true;
		roomInput.disabled = true;
		startCallButton.disabled = false;
		endCallButton.disabled = false;
	}
};

startCallButton.onclick = async () => {
	// Get user media
	try {
		localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		localAudio.srcObject = localStream;

		// Create a peer connection
		peerConnection = new RTCPeerConnection(servers);

		// Add local stream to peer connection
		localStream.getTracks().forEach((track) => {
			peerConnection.addTrack(track, localStream);
		});

		// Handle incoming tracks
		peerConnection.ontrack = (event) => {
			if (!remoteStream) {
				remoteStream = new MediaStream();
				remoteAudio.srcObject = remoteStream;
			}
			remoteStream.addTrack(event.track);
		};

		// Handle ICE candidates
		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				// Send candidate to the remote peer
				sendMessage('new-ice-candidate', event.candidate);
			}
		};

		// Create offer
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		sendMessage('offer', offer);
	} catch (error) {
		console.error('Error accessing media devices.', error);
	}
};

endCallButton.onclick = () => {
	if (peerConnection) {
		peerConnection.close();
		peerConnection = null;
	}
	localStream.getTracks().forEach((track) => track.stop());
	localAudio.srcObject = null;
	remoteAudio.srcObject = null;
};

function handleMessage(type, payload) {
	switch (type) {
		case 'offer':
			handleOffer(payload);
			break;
		case 'answer':
			handleAnswer(payload);
			break;
		case 'new-ice-candidate':
			handleNewIceCandidate(payload);
			break;
	}
}

async function handleOffer(offer) {
	if (!peerConnection) {
		peerConnection = new RTCPeerConnection(servers);
		peerConnection.ontrack = (event) => {
			if (!remoteStream) {
				remoteStream = new MediaStream();
				remoteAudio.srcObject = remoteStream;
			}
			remoteStream.addTrack(event.track);
		};

		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				sendMessage('new-ice-candidate', event.candidate);
			}
		};
	}

	await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

	localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
	localAudio.srcObject = localStream;
	localStream.getTracks().forEach((track) => {
		peerConnection.addTrack(track, localStream);
	});

	const answer = await peerConnection.createAnswer();
	await peerConnection.setLocalDescription(answer);
	sendMessage('answer', answer);
}

async function handleAnswer(answer) {
	await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleNewIceCandidate(candidate) {
	try {
		await peerConnection.addIceCandidate(candidate);
	} catch (error) {
		console.error('Error adding received ICE candidate', error);
	}
}
