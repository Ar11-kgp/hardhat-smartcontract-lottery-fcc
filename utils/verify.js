const { run } = require("hardhat")

async function verify(contractAddress, args) {
    // this will automatically verify our contracts after they are deployed
    // this works with block exploreres like etherscan
    console.log("Verifying contract...")
    try {
        await run("verify:verify", {
            // this is going to be an object that contains the actual parameters
            address: contractAddress,
            constructorArguments: args,
        })
        // in our code, we can actually run any task from hardhat using a run package
    } catch (e) {
        // e is any error that the above section throws
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!")
        } else {
            console.log(e)
        }
    } // we do try-catch bcoz we don't want our whole script to end and bcoz of these errors, our verify func will break and our whole script will end
    // we wish to be continuing if verification doesn't work, as its not a big deal
}

module.exports = { verify }
