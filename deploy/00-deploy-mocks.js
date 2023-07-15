const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.parseEther("0.25") //0.25 is the premium, it costs 0.25LINK per req
const GAS_PRICE_LINK = 1e9 // calculated value, based on the gas price of the chain.
// we are getting to know abt these parameters thru VRFCoordinatorV2Mock.sol file

// wen ETH price gets skyrocketed, the gas price does too
// Chainlink nodes pay the gas fees to give us randomness & do external execution
// these nodes onli call performUpkeep and fulfillRandomWords and pay their gas
// and they get paid in ORACLE gas to offset those costs
// the GAS_PRICE_LINK variable fluctuates based on the price of the actual chain so they never go bankrupt

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args = [BASE_FEE, GAS_PRICE_LINK]
    chainId = network.config.chainId
    // grabbing chainId as well bcoz we only want to deploy this on a development chain
    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deployment")
        // deploy a mock vrfcoordinator...LINK=Oracle gas
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })
        log("Mocks Deployed")
        log("--------------------------------------")
    }
}
