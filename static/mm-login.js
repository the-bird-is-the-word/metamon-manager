import { login } from './login-auth.js';
import { error_msg } from './utils.js';

const BSC_CHAIN_ID = 56;

[].forEach.call(document.getElementsByClassName("metamask-login"), (item, index) => {
    item.onclick = async ()=>{
        try  {
            if (!await check_metamask()) {
                return false;
            }
            if (!check_chain()) {
                return false;
            }

            const wallet_address = await get_wallet_address();
            await login(wallet_address, window.ethereum);
        }
        catch(error) {
            if (error.code == 4001) {
                error_msg("User denied MetaMask to sign the message. This is required to enter the Metamon Island.", "danger");
            }
        }
    };
});

async function check_metamask(wallet_address)
{
    let success = false;
    try {
        success = ethereum.isMetaMask;
    }
    catch (e) {
        console.log(e);
    }

    if (!success){
        error_msg("Cannot find Metamask!", "danger");
        return false;
    }
    return true;
}

function check_chain(wallet_address)
{
    if (ethereum.chainId != 56) {
        error_msg("You need to switch to Binance Smart Chain Mainnet!", "danger");
        return false;
    }
    return true;
}

async function get_wallet_address()
{
    try {
        let response = await ethereum.request({method: "eth_requestAccounts"});
        return response[0];
    } catch(e) {
        console.log(error);
        return 0;
    }
}