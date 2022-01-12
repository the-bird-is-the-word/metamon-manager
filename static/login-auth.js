import { ethers } from "./ethers-5.1.esm.min.js";
import { genRandomLoginMsg } from "./utils.js";

export async function login(wallet_address, web3)
{
    const msg = genRandomLoginMsg();

    const provider = new ethers.providers.Web3Provider(web3);
    const signer = provider.getSigner();
    const signature = await signer.signMessage(msg);

    await handle_auth(wallet_address, msg, signature);

    window.location.href = "/index";
}

export async function handle_auth(wallet_address, msg, signature)
{
    console.log(wallet_address);
    console.log(signature);

    const data = {address: wallet_address, message: msg, signature: signature}

    await fetch('login', {
            method: 'post',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
}
