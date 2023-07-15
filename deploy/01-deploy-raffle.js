const { deployContract } = require("ethereum-waffle")
const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../helper-hardhat-config")

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("2")
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId // to assign the SubscriptionCreated event to emit (check VRFV2CoordinatorMock)

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        // creating that subscription
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1) // block confirmation
        // inside this transactionReceipt there's an event thats emited
        subscriptionId = transactionReceipt.events[0].args.subId
        // now that we have a subscription, we need to fund this
        // usually we need the link token on a real network to fund
        // current iteration of the mock allows u to fund the sub without link
        await vrfCoordinatorV2Mock.fundSubcription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        // if it were not on a local network
        vrfCoordinatorV2Address = netwrokConfig[chainId]["vrfCoordinatorV2"]
        // we have got a setup to work with our vrfCoordinatorV2 address
        subscriptionId = networkConfig[chainId]["subcriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [
        vrfCoordinatorV2,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]
    // 1st argument will be VRFV2Coordinator
    const raffle = await deployContract("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(raffle.address, args)
    }
    log("----------------------------------------------")
}
module.exports.tags = ["all", "raffle"]
