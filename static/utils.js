function getRandomInt(max) {
  return Math.floor(Math.random() * max);
};

const genRandomHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

function genRandomLoginMsg() {
    // E.g. "LogIn-fab164a3-2f63-000d-159b-3b86868d8ffe"
    return "LogIn-" + genRandomHex(8) + "-" + genRandomHex(4) + "-" + genRandomHex(4) + "-" + genRandomHex(4) + "-" + genRandomHex(12);
}

export { getRandomInt, genRandomLoginMsg };

export function error_msg(msg, category) {
  // Make nice error messages using Bootstrap alerts
  const insert_str = "<div class='alert alert-dismissable fade show alert-" + category + "'> " + msg +
                     "  <button type='button' class='btn-close' data-bs-dismiss='alert' aria-label='Close' style='float: right'>" +
                      "   </button> </div>";
  console.log(insert_str);
  document.getElementById("alert-messages").insertAdjacentHTML('beforeend', insert_str);
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}