import { login, handle_auth } from "./login-auth.js";
import { genRandomLoginMsg, error_msg } from "./utils.js";
import { ethers } from "./ethers-5.1.esm.min.js";

//import lodash from 'lodash';
// import Web3 from "web3-provider-engine";
//import WalletConnectProvider from "./walletconnect-web3-provider";

/* import WalletConnectClient from "@walletconnect/client"; */
//const WalletConnectProvider = window.WalletConnectProvider.default;
//const Web3 = window.Web3.default;
let WalletConnectProvider;
if (window.WalletConnectProvider)
    WalletConnectProvider = window.WalletConnectProvider.default;
 
let wc_provider;
 
[].forEach.call(document.getElementsByClassName("walletconnect-login"), (item, index) => {
    item.onclick = async ()=>{
        //  Create WalletConnect Provider
        wc_provider = new WalletConnectProvider({
            //infuraId: "27e484dcd9e3efcfd25a83a78777cdf1", // Required
            rpc: {
                56: "https://bsc-dataseed.binance.org/"
              },
              chainId: 56
        });

        // Subscribe to accounts change
        wc_provider.on("accountsChanged", (accounts) => {
            console.log(accounts);
        });
        
        // Subscribe to session connection
        wc_provider.on("connect", connect);

        //if (get_wallet_address(wc_provider).length >= 42) {
            //await connect();
            wc_provider.disconnect();
        //}

            //  Enable session (triggers QR Code modal)
            try {
                await wc_provider.enable();
            }
            catch(error) {
                if (error == "Error: User closed modal") {
                    error_msg("User closed the window to connect via WalletConnect. Please login to use Metamon Manager.", "danger");
                }
            }
        
    };
});

async function connect () {
    const wallet_address = get_wallet_address(wc_provider);
    const msg = genRandomLoginMsg();

    const signature = await wc_provider.send(
        'personal_sign',
        [ ethers.utils.hexlify(ethers.utils.toUtf8Bytes(msg)), wallet_address.toLowerCase() ]
    );

    console.log(signature);

    await handle_auth(wallet_address, msg, signature);

    window.location.href = "/index";

    //await login(wallet_address, wc_provider);

        /*
    const provider = new ethers.providers.Web3Provider(wc_provider);
    const signer = provider.getSigner();
    const signature = await signer.signMessage("Test");
    const address = await signer.getAddress();

    const address2 = wc_provider.wc.accounts[0];

    let signedMessage = await wc_provider.send(
        'personal_sign',
        [ ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Test")), address2.toLowerCase() ]
    );

    const web3 = new Web3(provider);
    const accounts = await web3.eth.getAccounts();
    */
};

function get_wallet_address(wc_provider) {
    try {
        return wc_provider.wc.accounts[0].toLowerCase();
    } catch(e) {
        console.log(e);
        return "";
    }
};