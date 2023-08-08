// we only want our staging test to run, wen we r on a testnet. unit tests on local network
const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { experimentalAddHardhatNetworkMessageTraceHook } = require("hardhat/config")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name) // syays that run this onli on testnet
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let raffle, /*vrfCoordinatorV2Mock*/ raffleEntranceFee, deployer
          // we won't need a vrfCoordinatorV2Mock since we're on an actual test net

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  // we just have to enter the raffle nd nthng else
                  // bcoz the chainlink keepers ns the chainlinkVRF r the only ones who will kickoff this lottery for us
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()
                  // setup listener before we enter the raffle, just in case the blockchain moves really fast
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          // setting up listener
                          console.log("WinnerPicked event fired!")

                          try {
                              // add our asserts here
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0] //deployer
                              const endingTimeStamp = await raffle.getLatestTimeStamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted // one way to check if our players[] has been reset
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(raffleState, 0) // back to OPEN after we r done
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(e)
                          }
                      })

                      // entering the raffle after setting up our listener
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      const winnerStartingBalance = await accounts[0].getBalance()
                      // this code won't complete until our listener has finished listening
                  })
              })
          })
      })
/* for us to test this staging test, we 1st gonna need to get our SubId for rhe chainlinkVRF
then we will need to deploy our contract using this subId, we r going to register our contract 
with chainlinkVRF. then we need to register it with chainlink keepers nd then we will run the staging tests

1. Get our subId for chainlinkVRF
2. Deploy our contract using the subId
3. Register the contract with chainlinkVRF nd its subId
4. Register the contract with chainlink Keepers
5. Run staging tests */
