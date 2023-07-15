//const { ethers } = require("hardhat")
const networkConfig = {
    // for hardhat we will use mocks, hence no need to mention here
    11155111: {
        // chainId of sepolia
        name: "sepolia",
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subscriptionId: "0",
        callbackGasLimit: "500000", // will vary from network to network
        interval: "30",
    },
    31337: {
        // hardhat
        // not gonna give verfCoordinator address as we deploying mock for this
        name: "hadhat",
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "500000",
        interval: "30",
    },
}

// as we want mocks to get deployed on chainId only, we will grab them here
const developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChains,
}
