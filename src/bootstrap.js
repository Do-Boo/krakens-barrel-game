import '../styles.css';

const params = new URLSearchParams(window.location.search);
const isController = params.has('room') || params.has('controller');

if (isController) {
  document.querySelector('#app').hidden = true;
  document.querySelector('#controller-app').hidden = false;
  import('./controller.js');
} else {
  import('./main.js');
}
