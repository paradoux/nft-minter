const { expect } = require("chai")

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { ethers } = require("hardhat")

const initialMintingPrice = ethers.utils.parseEther("1")
const newMintingPrice = ethers.utils.parseEther("0.5")
const tokenURI = "ipfs://QmR9RNGq2ydEB73arpaLZTbU616RF6sG6ikKM64yXVEK5H"

describe("NFTGenerator contract", function () {
  async function deployContractFixture() {
    const NFTGenerator = await ethers.getContractFactory("NFTGenerator")
    const [owner, account1, account2] = await ethers.getSigners()

    const hardhatNFTGenerator = await NFTGenerator.deploy(initialMintingPrice)

    await hardhatNFTGenerator.deployed()

    return { NFTGenerator, hardhatNFTGenerator, owner, account1, account2 }
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { hardhatNFTGenerator, owner } = await loadFixture(
        deployContractFixture
      )
      expect(await hardhatNFTGenerator.owner()).to.equal(owner.address)
    })

    it("Should set the right minting price", async function () {
      const { hardhatNFTGenerator } = await loadFixture(deployContractFixture)
      const mintingPrice = await hardhatNFTGenerator.mintingPrice()
      expect(mintingPrice).to.equal(initialMintingPrice)
    })
  })

  describe("GenerateNFT", function () {
    describe("When paid amount is not the minting price", function () {
      it("should revert with the correct message", async function () {
        const { hardhatNFTGenerator, account1, account2 } = await loadFixture(
          deployContractFixture
        )
        await expect(
          hardhatNFTGenerator.generateNFT(tokenURI, {
            value: ethers.utils.parseEther("0.5")
          })
        ).to.be.revertedWith("Incorrect paid amount, check price")
      })
    })

    describe("When tokenURI is empty", function () {
      it("should revert with the correct message", async function () {
        const { hardhatNFTGenerator, account1, account2 } = await loadFixture(
          deployContractFixture
        )
        await expect(
          hardhatNFTGenerator.generateNFT("", {
            value: ethers.utils.parseEther("1")
          })
        ).to.be.revertedWith("tokenURI can't be empty")
      })
    })

    describe("When everything is correct", function () {
      it("should mint a new NFT with the correct data", async function () {
        const { hardhatNFTGenerator, account1, account2 } = await loadFixture(
          deployContractFixture
        )
        await hardhatNFTGenerator.connect(account1).generateNFT(tokenURI, {
          value: initialMintingPrice
        })

        const ownerAddress = await hardhatNFTGenerator.ownerOf(0)
        const mintedTokenURI = await hardhatNFTGenerator.tokenURI(0)

        await expect(ownerAddress).to.be.equal(account1.address)
        await expect(mintedTokenURI).to.be.equal(tokenURI)
      })

      it("should add the new minted NFT to the mintedNFTs mapping", async function () {
        const { hardhatNFTGenerator, account1, account2 } = await loadFixture(
          deployContractFixture
        )
        await hardhatNFTGenerator.connect(account1).generateNFT(tokenURI, {
          value: initialMintingPrice
        })

        const account1NFT = await hardhatNFTGenerator.mintedNFTs(
          account1.address,
          0
        )

        expect(account1NFT.id).to.be.equal(0)
        expect(account1NFT.creator).to.be.equal(account1.address)
        expect(account1NFT.tokenURI).to.be.equal(tokenURI)
      })

      it("should emit the NFTMinted event", async function () {
        const { hardhatNFTGenerator, account1, account2 } = await loadFixture(
          deployContractFixture
        )

        await expect(
          hardhatNFTGenerator.connect(account1).generateNFT(tokenURI, {
            value: initialMintingPrice
          })
        )
          .to.emit(hardhatNFTGenerator, "NFTMinted")
          .withArgs(0, account1.address, tokenURI)
      })
    })
  })

  describe("Admin functions", function () {
    describe("setPrice", function () {
      describe("when caller is not the admin", function () {
        it("should revert with correct message", async function () {
          const { hardhatNFTGenerator, account1, account2 } = await loadFixture(
            deployContractFixture
          )
          await expect(
            hardhatNFTGenerator.connect(account1).setPrice(newMintingPrice)
          ).to.be.revertedWith("Ownable: caller is not the owner")
        })
      })

      describe("when caller is the admin", function () {
        it("should change the minting price", async function () {
          const { hardhatNFTGenerator, owner } = await loadFixture(
            deployContractFixture
          )

          await hardhatNFTGenerator.connect(owner).setPrice(newMintingPrice)

          const updatedMintingPrice = await hardhatNFTGenerator.mintingPrice()
          await expect(updatedMintingPrice).to.be.equal(newMintingPrice)
        })
      })
    })

    describe("withdrawFunds", function () {
      describe("when caller is not the admin", function () {
        it("should revert with correct message", async function () {
          const { hardhatNFTGenerator, account1 } = await loadFixture(
            deployContractFixture
          )

          await expect(
            hardhatNFTGenerator
              .connect(account1)
              .withdrawFunds(account1.address)
          ).to.be.revertedWith("Ownable: caller is not the owner")
        })
      })

      describe("when caller is the admin", function () {
        it("should withdraw the funds to the receiver address", async function () {
          const { hardhatNFTGenerator, owner, account1 } = await loadFixture(
            deployContractFixture
          )

          await hardhatNFTGenerator.connect(account1).generateNFT(tokenURI, {
            value: initialMintingPrice
          })

          const initialOwnerBalance = await ethers.provider.getBalance(
            owner.address
          )
          const tx = await hardhatNFTGenerator
            .connect(owner)
            .withdrawFunds(owner.address)

          const receipt = await tx.wait()
          const gasPrice = tx.gasPrice
          const gasUsed = receipt.gasUsed

          const updatedContractBalance = await ethers.provider.getBalance(
            hardhatNFTGenerator.address
          )
          const updatedOwnerBalance = await ethers.provider.getBalance(
            owner.address
          )

          expect(updatedContractBalance).to.be.equal(0)
          expect(updatedOwnerBalance).to.be.equal(
            initialOwnerBalance
              .add(initialMintingPrice)
              .sub(gasPrice.mul(gasUsed))
          )
        })

        it("should emit the WithdrawnFunds event", async function () {
          const { hardhatNFTGenerator, owner, account1 } = await loadFixture(
            deployContractFixture
          )

          await hardhatNFTGenerator.connect(account1).generateNFT(tokenURI, {
            value: initialMintingPrice
          })

          await expect(
            hardhatNFTGenerator.connect(owner).withdrawFunds(owner.address)
          )
            .to.emit(hardhatNFTGenerator, "WithdrawnFunds")
            .withArgs(initialMintingPrice, owner.address)
        })
      })
    })
  })
})
