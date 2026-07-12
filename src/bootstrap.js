import '../styles.css';

const controllerPeerId = new URLSearchParams(window.location.search).get('controller');

if (controllerPeerId) {
  document.querySelector('#app').hidden = true;
  document.querySelector('#controller-app').hidden = false;
  import('./controller.js');
} else {
  import('./main.js');
}
