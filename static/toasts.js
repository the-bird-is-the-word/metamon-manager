import { error_msg } from "./utils.js";

function showPrivacyToast(show) {
    var toastElement = document.getElementById('gdprToast');
    if (toastElement) {
        var toast = new bootstrap.Toast(toastElement);
        if (show) {
            toast.show();
        }
        else {
            toast.hide();
        }
    };
};

// Event Listener
document.addEventListener('DOMContentLoaded', initConsent);

async function initConsent () {
    if (consentRequired()) {
        showPrivacyToast(true);
    }
    else {
        await sendConsent("NOT_REQUIRED");
    }
};

var notAgree = document.getElementById('privacy-not-agree');
if (notAgree)
    notAgree.onclick = notAcceptGDPR;
var agree = document.getElementById('privacy-agree');
if (agree)
    agree.onclick = acceptGDPR;

async function notAcceptGDPR () {
    showPrivacyToast(false);
    error_msg("You need to accept to placing cookies to use this website. Functionality will be restricted.", "danger");
    await sendConsent(false);
};

async function acceptGDPR () {
    await sendConsent(true);
};

async function sendConsent(consent) {
    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
          },
        body: JSON.stringify({"consent": consent})
    };
    await fetch('/consent', options);
};

/**
 * Determine whether a consent to setting cookies according to teh GDPR is required.
 * @returns true if a user is likely living in EU
 */
function consentRequired() {
    let tz = "";
    try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (err) {
        return true;
    }

    switch (tz) {
      case 'Europe/Vienna':
        return true;
      case 'Europe/Brussels':
        return true;
      case 'Europe/Sofia':
        return true;
      case 'Europe/Zagreb':
        return true;
      case 'Asia/Famagusta':
        return true;
      case 'Asia/Nicosia':
        return true;
      case 'Europe/Prague':
        return true;
      case 'Europe/Copenhagen':
        return true;
      case 'Europe/Tallinn':
        return true;
      case 'Europe/Helsinki':
        return true;
      case 'Europe/Paris':
        return true;
      case 'Europe/Berlin':
        return true;
      case 'Europe/Busingen':
        return true;
      case 'Europe/Athens':
        return true;
      case 'Europe/Budapest':
        return true;
      case 'Europe/Dublin':
        return true;
      case 'Europe/Rome':
        return true;
      case 'Europe/Riga':
        return true;
      case 'Europe/Vilnius':
        return true;
      case 'Europe/Luxembourg':
        return true;
      case 'Europe/Malta':
        return true;
      case 'Europe/Amsterdam':
        return true;
      case 'Europe/Warsaw':
        return true;
      case 'Atlantic/Azores':
        return true;
      case 'Atlantic/Madeira':
        return true;
      case 'Europe/Lisbon':
        return true;
      case 'Europe/Bucharest':
        return true;
      case 'Europe/Bratislava':
        return true;
      case 'Europe/Ljubljana':
        return true;
      case 'Africa/Ceuta':
        return true;
      case 'Atlantic/Canary':
        return true;
      case 'Europe/Madrid':
        return true;
      case 'Europe/Stockholm':
        return true;
      default:
        return false;
    }
};