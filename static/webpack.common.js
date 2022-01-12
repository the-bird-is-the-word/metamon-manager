const path = require('path');

module.exports = {
    entry: ['./statistics.js', './manager.js', './mm-login.js', './walletconnect-login.js', './toasts.js'],

    plugins: [
    ],

    output: {
        filename: 'app.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
      },
};