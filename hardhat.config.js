require("@nomicfoundation/hardhat-toolbox")
// require("@nomiclabs/hardhat-etherscan")
require("@nomicfoundation/hardhat-verify")
require("@nomicfoundation/hardhat-ethers")
require("hardhat-deploy-ethers")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const SEPOLIA_URL = process.env.SEPOLIA_URL || "https://eth-sepolia" // just if I do not use sepolia
const PRIVATE_KEY = process.env.PRIVATE_KEY || "Oxkey"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "key"
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "key"

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },

        localhost: {
            chainId: 31337,
        },

        sepolia: {
            chainId: 11155111,
            blockConfirmations: 6,
            url: SEPOLIA_URL,
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
        },
    },
    solidity: "0.8.8",
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        timeout: 200000, // 200 sec max
    },
}
