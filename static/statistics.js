import { format } from 'date-fns';
import { enUS, de , zhCN} from 'date-fns/locale';
const locale_obj = {
    "en": enUS,
    "en-US": enUS,
    "de": de,
    "zh": zhCN,
    "zh-CN": zhCN
}

function getLang() {
    if (navigator.languages != undefined) 
      return navigator.languages[0]; 
    return navigator.language;
};

function getLocale() {
    const lang = getLang();
    let locale = locale_obj[lang];

    if (!locale)
        locale = locale_obj["en"];
    
    return locale;
};

const locale = getLocale();
// console.log(locale);

function dateTimeFormatter(timestamp) {
    return format(new Date(timestamp), "dd/MM/yyyy HH:mm");
    //return format(new Date(timestamp), "Pp", {"locale": locale_obj[locale]});
}

window.dateTimeFormatter = dateTimeFormatter;

document.addEventListener("DOMContentLoaded", function (event) {
    try {
        $("#table-stats-metamons").on("post-header.bs.table", adjustExportButton);
    }
    catch (error) {}
});

function adjustExportButton () {
    const export_elements = document.getElementsByClassName("export");
    if (export_elements.length > 0) {
        const element = export_elements[0];
        const button = element.getElementsByTagName("button")[0];
        button.textContent = "Export";

        // If data is not available, disable button
        if (! ($("#table-stats-metamons")[0].dataset.url))
            button.disabled = true
    }

    adjustTable();
}

function adjustTable () {
    // Makes borders in the middle of the table head to separate "Metamon" and "Results"
    const el = $(".tr-class-1")[0];
    el.getElementsByTagName("th")[1].style.borderLeft = "2px solid #444444";
    const el2 = $(".tr-class-2")[0];
    el2.getElementsByTagName("th")[5].style.borderLeft = "2px solid #444444";
}