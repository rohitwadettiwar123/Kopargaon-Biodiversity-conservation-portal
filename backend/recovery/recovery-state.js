let currentState = 'ONLINE';
module.exports = {
  getState: () => currentState,
  setState: (state) => { currentState = state; }
};
