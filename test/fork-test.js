const hre = require("hardhat");
const { expect } = require("chai");

describe("Jacob NFA - Full End-to-End Test Suite", function () {
  this.timeout(120000);

  let deployer, user1, user2, user3;
  let jacobToken, bap578, agentMinter, agentVault, controller;

  before(async function () {
    [deployer, user1, user2, user3] = await hre.ethers.getSigners();

    console.log("  Deployer:", deployer.address);
    console.log("  User1:", user1.address);
    console.log("  User2:", user2.address);

    const AgentController = await hre.ethers.getContractFactory("AgentController");
    controller = await AgentController.deploy();
    await controller.waitForDeployment();

    const BAP578NFA = await hre.ethers.getContractFactory("BAP578NFA");
    bap578 = await hre.upgrades.deployProxy(
      BAP578NFA,
      ["jacob", "JACOB", deployer.address],
      { kind: "uups" }
    );
    await bap578.waitForDeployment();

    await bap578.setController(await controller.getAddress());

    const JacobToken = await hre.ethers.getContractFactory("JacobToken");
    jacobToken = await JacobToken.deploy(deployer.address, await bap578.getAddress());
    await jacobToken.waitForDeployment();

    const AgentVault = await hre.ethers.getContractFactory("AgentVault");
    agentVault = await AgentVault.deploy(
      await bap578.getAddress(),
      deployer.address,
      deployer.address
    );
    await agentVault.waitForDeployment();

    const AgentMinter = await hre.ethers.getContractFactory("AgentMinter");
    agentMinter = await AgentMinter.deploy(
      await jacobToken.getAddress(),
      await bap578.getAddress()
    );
    await agentMinter.waitForDeployment();

    await bap578.setMinter(await agentMinter.getAddress());

    await jacobToken.setWhitelist(await agentMinter.getAddress(), true);
    await jacobToken.setWhitelist(await agentVault.getAddress(), true);
    await jacobToken.setWhitelist(deployer.address, true);
    await jacobToken.setWhitelist(user1.address, true);
    await jacobToken.setWhitelist(user2.address, true);

    console.log("  BAP578NFA:", await bap578.getAddress());
    console.log("  JacobToken:", await jacobToken.getAddress());
    console.log("  AgentMinter:", await agentMinter.getAddress());
    console.log("  AgentVault:", await agentVault.getAddress());
    console.log("  All contracts deployed and wired.\n");
  });

  describe("1. Contract State Verification", function () {
    it("should have correct ownership on all contracts", async function () {
      expect(await jacobToken.owner()).to.equal(deployer.address);
      expect(await bap578.owner()).to.equal(deployer.address);
      expect(await agentMinter.owner()).to.equal(deployer.address);
      expect(await agentVault.owner()).to.equal(deployer.address);
    });

    it("should have correct minter set on BAP578NFA", async function () {
      expect(await bap578.minter()).to.equal(await agentMinter.getAddress());
    });

    it("should have AgentMinter and AgentVault whitelisted on JacobToken", async function () {
      expect(await jacobToken.whitelisted(await agentMinter.getAddress())).to.be.true;
      expect(await jacobToken.whitelisted(await agentVault.getAddress())).to.be.true;
    });

    it("should have 1M total supply held by deployer", async function () {
      const supply = await jacobToken.totalSupply();
      expect(supply).to.equal(hre.ethers.parseEther("1000000"));
      const bal = await jacobToken.balanceOf(deployer.address);
      expect(bal).to.equal(hre.ethers.parseEther("1000000"));
    });

    it("should have correct tier costs", async function () {
      expect(await agentMinter.getTierCost(1)).to.equal(hre.ethers.parseEther("10"));
      expect(await agentMinter.getTierCost(2)).to.equal(hre.ethers.parseEther("50"));
      expect(await agentMinter.getTierCost(3)).to.equal(hre.ethers.parseEther("250"));
      expect(await agentMinter.getTierCost(4)).to.equal(hre.ethers.parseEther("1000"));
      expect(await agentMinter.getTierCost(5)).to.equal(hre.ethers.parseEther("10000"));
    });

    it("should have correct mint fees", async function () {
      expect(await agentMinter.getMintFee(1)).to.equal(hre.ethers.parseEther("0.005"));
      expect(await agentMinter.getMintFee(2)).to.equal(hre.ethers.parseEther("0.02"));
      expect(await agentMinter.getMintFee(3)).to.equal(hre.ethers.parseEther("0.1"));
      expect(await agentMinter.getMintFee(4)).to.equal(hre.ethers.parseEther("0.5"));
      expect(await agentMinter.getMintFee(5)).to.equal(hre.ethers.parseEther("2.0"));
    });

    it("should have correct tier swap limits", async function () {
      expect(await agentVault.tierSwapLimit(1)).to.equal(hre.ethers.parseEther("0.1"));
      expect(await agentVault.tierSwapLimit(2)).to.equal(hre.ethers.parseEther("0.5"));
      expect(await agentVault.tierSwapLimit(3)).to.equal(hre.ethers.parseEther("2"));
      expect(await agentVault.tierSwapLimit(4)).to.equal(hre.ethers.parseEther("10"));
      expect(await agentVault.tierSwapLimit(5)).to.equal(hre.ethers.MaxUint256);
    });

    it("should not be paused", async function () {
      expect(await bap578.pausedStatus()).to.equal(0);
      expect(await agentMinter.paused()).to.be.false;
      expect(await agentVault.paused()).to.be.false;
    });
  });

  describe("2. Bronze Mint - Full User Journey", function () {
    before(async function () {
      await jacobToken.transfer(user1.address, hre.ethers.parseEther("100"));
    });

    it("user1 should have 100 JACOB (simulating DEX purchase)", async function () {
      const bal = await jacobToken.balanceOf(user1.address);
      expect(bal).to.equal(hre.ethers.parseEther("100"));
    });

    it("user1 approves AgentMinter to spend JACOB", async function () {
      await jacobToken.connect(user1).approve(
        await agentMinter.getAddress(),
        hre.ethers.MaxUint256
      );
      const allowanceVal = await jacobToken.allowance(
        user1.address,
        await agentMinter.getAddress()
      );
      expect(allowanceVal).to.equal(hre.ethers.MaxUint256);
    });

    it("user1 mints Bronze agent (burn 10 JACOB + 0.005 BNB fee)", async function () {
      const balBefore = await jacobToken.balanceOf(user1.address);

      const tx = await agentMinter.connect(user1).mintAgent(1, {
        value: hre.ethers.parseEther("0.005"),
      });
      await tx.wait();

      const balAfter = await jacobToken.balanceOf(user1.address);
      expect(balBefore - balAfter).to.equal(hre.ethers.parseEther("10"));

      const nftBal = await bap578.balanceOf(user1.address);
      expect(nftBal).to.equal(1);

      const tokenId = await bap578.tokenOfOwnerByIndex(user1.address, 0);
      expect(await bap578.getAgentTier(tokenId)).to.equal(1);
      expect(await bap578.agentBurnedAmount(tokenId)).to.equal(hre.ethers.parseEther("10"));

      console.log("    Minted Bronze agent tokenId:", tokenId.toString());
    });

    it("total supply decreased by 10 JACOB", async function () {
      const supply = await jacobToken.totalSupply();
      expect(supply).to.equal(hre.ethers.parseEther("999990"));
    });

    it("AgentMinter tracks mint stats", async function () {
      expect(await agentMinter.totalMinted()).to.equal(1);
      expect(await agentMinter.totalTokensBurned()).to.equal(hre.ethers.parseEther("10"));
      expect(await agentMinter.tierMintCount(1)).to.equal(1);
    });
  });

  describe("3. Excess BNB Refund", function () {
    before(async function () {
      await jacobToken.transfer(user2.address, hre.ethers.parseEther("10"));
      await jacobToken.connect(user2).approve(
        await agentMinter.getAddress(),
        hre.ethers.MaxUint256
      );
    });

    it("should refund excess BNB when overpaying (send 1 BNB, fee is 0.005)", async function () {
      const bnbBefore = await hre.ethers.provider.getBalance(user2.address);

      const tx = await agentMinter.connect(user2).mintAgent(1, {
        value: hre.ethers.parseEther("1.0"),
      });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const bnbAfter = await hre.ethers.provider.getBalance(user2.address);
      const bnbSpent = bnbBefore - bnbAfter - gasUsed;

      expect(bnbSpent).to.be.closeTo(
        hre.ethers.parseEther("0.005"),
        hre.ethers.parseEther("0.0001")
      );
      console.log("    BNB spent (should be ~0.005):", hre.ethers.formatEther(bnbSpent));
    });

    it("should work with exact fee (no refund needed)", async function () {
      await jacobToken.transfer(user2.address, hre.ethers.parseEther("10"));

      const bnbBefore = await hre.ethers.provider.getBalance(user2.address);
      const tx = await agentMinter.connect(user2).mintAgent(1, {
        value: hre.ethers.parseEther("0.005"),
      });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const bnbAfter = await hre.ethers.provider.getBalance(user2.address);
      const bnbSpent = bnbBefore - bnbAfter - gasUsed;

      expect(bnbSpent).to.be.closeTo(
        hre.ethers.parseEther("0.005"),
        hre.ethers.parseEther("0.0001")
      );
    });
  });

  describe("4. Error Cases - Input Validation", function () {
    it("should reject invalid tier (0)", async function () {
      await expect(
        agentMinter.connect(user1).mintAgent(0, { value: hre.ethers.parseEther("0.005") })
      ).to.be.revertedWith("Invalid tier");
    });

    it("should reject invalid tier (6)", async function () {
      await expect(
        agentMinter.connect(user1).mintAgent(6, { value: hre.ethers.parseEther("0.005") })
      ).to.be.revertedWith("Invalid tier");
    });

    it("should reject insufficient BNB fee", async function () {
      await expect(
        agentMinter.connect(user1).mintAgent(1, { value: hre.ethers.parseEther("0.001") })
      ).to.be.revertedWith("Insufficient BNB mint fee");
    });

    it("should reject insufficient JACOB balance", async function () {
      await expect(
        agentMinter.connect(user3).mintAgent(1, { value: hre.ethers.parseEther("0.005") })
      ).to.be.revertedWith("Insufficient JACOB balance");
    });

    it("should reject minting without JACOB approval", async function () {
      await jacobToken.transfer(user3.address, hre.ethers.parseEther("10"));
      await expect(
        agentMinter.connect(user3).mintAgent(1, { value: hre.ethers.parseEther("0.005") })
      ).to.be.revertedWith("Insufficient allowance");
    });
  });

  describe("5. NFT Metadata (tokenURI) - Base64 Encoding", function () {
    it("should return valid base64-encoded JSON for Bronze agent", async function () {
      const tokenId = await bap578.tokenOfOwnerByIndex(user1.address, 0);
      const uri = await bap578.tokenURI(tokenId);

      expect(uri).to.match(/^data:application\/json;base64,/);

      const base64Data = uri.replace("data:application/json;base64,", "");
      const jsonStr = Buffer.from(base64Data, "base64").toString("utf8");
      const metadata = JSON.parse(jsonStr);

      console.log("    Metadata:", JSON.stringify(metadata, null, 2));

      expect(metadata).to.have.property("name");
      expect(metadata).to.have.property("description");
      expect(metadata).to.have.property("attributes");
      expect(metadata.attributes).to.be.an("array");

      const tierAttr = metadata.attributes.find((a) => a.trait_type === "Tier");
      expect(tierAttr).to.not.be.undefined;
      expect(tierAttr.value).to.equal("Bronze");

      const burnedAttr = metadata.attributes.find((a) => a.trait_type === "Burned JACOB");
      expect(burnedAttr).to.not.be.undefined;
    });

    it("should return valid metadata for Silver agent", async function () {
      await jacobToken.transfer(user1.address, hre.ethers.parseEther("50"));

      await agentMinter.connect(user1).mintAgent(2, { value: hre.ethers.parseEther("0.02") });

      const nftCount = await bap578.balanceOf(user1.address);
      const tokenId = await bap578.tokenOfOwnerByIndex(user1.address, Number(nftCount) - 1);
      const uri = await bap578.tokenURI(tokenId);
      const base64Data = uri.replace("data:application/json;base64,", "");
      const metadata = JSON.parse(Buffer.from(base64Data, "base64").toString("utf8"));

      const tierAttr = metadata.attributes.find((a) => a.trait_type === "Tier");
      expect(tierAttr.value).to.equal("Silver");
      console.log("    Silver metadata:", JSON.stringify(metadata));
    });

    it("should return valid metadata for Gold agent", async function () {
      await jacobToken.transfer(user1.address, hre.ethers.parseEther("250"));

      await agentMinter.connect(user1).mintAgent(3, { value: hre.ethers.parseEther("0.1") });

      const nftCount = await bap578.balanceOf(user1.address);
      const tokenId = await bap578.tokenOfOwnerByIndex(user1.address, Number(nftCount) - 1);
      const uri = await bap578.tokenURI(tokenId);
      const base64Data = uri.replace("data:application/json;base64,", "");
      const metadata = JSON.parse(Buffer.from(base64Data, "base64").toString("utf8"));

      const tierAttr = metadata.attributes.find((a) => a.trait_type === "Tier");
      expect(tierAttr.value).to.equal("Gold");
      console.log("    Gold metadata:", JSON.stringify(metadata));
    });

    it("should return valid metadata for Diamond agent", async function () {
      await jacobToken.transfer(user1.address, hre.ethers.parseEther("1000"));

      await agentMinter.connect(user1).mintAgent(4, { value: hre.ethers.parseEther("0.5") });

      const nftCount = await bap578.balanceOf(user1.address);
      const tokenId = await bap578.tokenOfOwnerByIndex(user1.address, Number(nftCount) - 1);
      const uri = await bap578.tokenURI(tokenId);
      const base64Data = uri.replace("data:application/json;base64,", "");
      const metadata = JSON.parse(Buffer.from(base64Data, "base64").toString("utf8"));

      const tierAttr = metadata.attributes.find((a) => a.trait_type === "Tier");
      expect(tierAttr.value).to.equal("Diamond");
      console.log("    Diamond metadata:", JSON.stringify(metadata));
    });
  });

  describe("6. Black Tier Minting (10,000 JACOB + 2 BNB)", function () {
    it("should mint Black tier agent", async function () {
      await jacobToken.transfer(user1.address, hre.ethers.parseEther("10000"));

      const tx = await agentMinter.connect(user1).mintAgent(5, {
        value: hre.ethers.parseEther("2"),
      });
      await tx.wait();

      const nftCount = await bap578.balanceOf(user1.address);
      const lastTokenId = await bap578.tokenOfOwnerByIndex(user1.address, Number(nftCount) - 1);
      expect(await bap578.getAgentTier(lastTokenId)).to.equal(5);

      const uri = await bap578.tokenURI(lastTokenId);
      const base64Data = uri.replace("data:application/json;base64,", "");
      const metadata = JSON.parse(Buffer.from(base64Data, "base64").toString("utf8"));
      const tierAttr = metadata.attributes.find((a) => a.trait_type === "Tier");
      expect(tierAttr.value).to.equal("Black");

      console.log("    Black tier agent minted, tokenId:", lastTokenId.toString());
      console.log("    Black metadata:", JSON.stringify(metadata));
    });
  });

  describe("7. AgentVault - Fund, Withdraw, Access Control", function () {
    let agentTokenId;

    before(async function () {
      agentTokenId = await bap578.tokenOfOwnerByIndex(user1.address, 0);
      await jacobToken.transfer(user1.address, hre.ethers.parseEther("100"));
      await jacobToken.connect(user1).approve(
        await agentVault.getAddress(),
        hre.ethers.parseEther("100")
      );
    });

    it("should fund agent with JACOB tokens", async function () {
      await agentVault.connect(user1).fundAgent(
        agentTokenId,
        await jacobToken.getAddress(),
        hre.ethers.parseEther("50")
      );

      const bal = await agentVault.balances(agentTokenId, await jacobToken.getAddress());
      expect(bal).to.equal(hre.ethers.parseEther("50"));
    });

    it("agent owner can withdraw", async function () {
      const balBefore = await jacobToken.balanceOf(user1.address);
      await agentVault.connect(user1).withdrawFromAgent(
        agentTokenId,
        await jacobToken.getAddress(),
        hre.ethers.parseEther("20")
      );
      const balAfter = await jacobToken.balanceOf(user1.address);
      expect(balAfter - balBefore).to.equal(hre.ethers.parseEther("20"));
    });

    it("non-owner cannot withdraw", async function () {
      await expect(
        agentVault.connect(user2).withdrawFromAgent(
          agentTokenId,
          await jacobToken.getAddress(),
          hre.ethers.parseEther("1")
        )
      ).to.be.revertedWith("Not agent NFT owner");
    });

    it("cannot withdraw more than balance", async function () {
      await expect(
        agentVault.connect(user1).withdrawFromAgent(
          agentTokenId,
          await jacobToken.getAddress(),
          hre.ethers.parseEther("999")
        )
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("8. NFT Transfer Changes Vault Access", function () {
    it("transferring NFT changes who can withdraw from vault", async function () {
      const agentTokenId = await bap578.tokenOfOwnerByIndex(user1.address, 0);

      await jacobToken.transfer(user1.address, hre.ethers.parseEther("10"));
      await jacobToken.connect(user1).approve(
        await agentVault.getAddress(),
        hre.ethers.parseEther("10")
      );
      await agentVault.connect(user1).fundAgent(
        agentTokenId,
        await jacobToken.getAddress(),
        hre.ethers.parseEther("10")
      );

      await bap578.connect(user1).transferFrom(user1.address, user2.address, agentTokenId);
      expect(await bap578.ownerOf(agentTokenId)).to.equal(user2.address);

      await agentVault.connect(user2).withdrawFromAgent(
        agentTokenId,
        await jacobToken.getAddress(),
        hre.ethers.parseEther("5")
      );

      await expect(
        agentVault.connect(user1).withdrawFromAgent(
          agentTokenId,
          await jacobToken.getAddress(),
          hre.ethers.parseEther("1")
        )
      ).to.be.revertedWith("Not agent NFT owner");

      console.log("    NFT transferred: old owner blocked, new owner can withdraw");
    });
  });

  describe("9. Pause / Unpause Controls", function () {
    it("owner can pause AgentMinter", async function () {
      await agentMinter.pause();
      expect(await agentMinter.paused()).to.be.true;

      await jacobToken.transfer(user1.address, hre.ethers.parseEther("10"));
      await jacobToken.connect(user1).approve(
        await agentMinter.getAddress(),
        hre.ethers.MaxUint256
      );
      await expect(
        agentMinter.connect(user1).mintAgent(1, { value: hre.ethers.parseEther("0.005") })
      ).to.be.revertedWith("Minting is paused");
    });

    it("owner can unpause AgentMinter", async function () {
      await agentMinter.unpause();
      expect(await agentMinter.paused()).to.be.false;

      await agentMinter.connect(user1).mintAgent(1, { value: hre.ethers.parseEther("0.005") });
    });

    it("owner can pause BAP578NFA", async function () {
      await bap578.pause(1);
      expect(await bap578.pausedStatus()).to.equal(1);
    });

    it("minting blocked when BAP578NFA paused", async function () {
      await jacobToken.transfer(user1.address, hre.ethers.parseEther("10"));
      await expect(
        agentMinter.connect(user1).mintAgent(1, { value: hre.ethers.parseEther("0.005") })
      ).to.be.reverted;
    });

    it("owner can unpause BAP578NFA", async function () {
      await bap578.unpause();
      expect(await bap578.pausedStatus()).to.equal(0);
    });

    it("non-owner cannot pause AgentMinter", async function () {
      await expect(agentMinter.connect(user1).pause()).to.be.revertedWith("Not owner");
    });
  });

  describe("10. Fee Distribution (60/40 Split)", function () {
    it("should send 100% of fees to owner when revenueSharing not set", async function () {
      const ownerBalBefore = await hre.ethers.provider.getBalance(deployer.address);

      await jacobToken.transfer(user1.address, hre.ethers.parseEther("10"));
      await jacobToken.connect(user1).approve(
        await agentMinter.getAddress(),
        hre.ethers.MaxUint256
      );

      await agentMinter.connect(user1).mintAgent(1, {
        value: hre.ethers.parseEther("0.005"),
      });

      const ownerBalAfter = await hre.ethers.provider.getBalance(deployer.address);
      const received = ownerBalAfter - ownerBalBefore;

      expect(received).to.be.closeTo(
        hre.ethers.parseEther("0.005"),
        hre.ethers.parseEther("0.001")
      );
      console.log("    Owner received full fee:", hre.ethers.formatEther(received), "BNB");
    });

    it("should track total mint fees collected", async function () {
      const totalFees = await agentMinter.totalMintFeesCollected();
      expect(totalFees).to.be.greaterThan(0);
      console.log("    Total fees collected:", hre.ethers.formatEther(totalFees), "BNB");
    });
  });

  describe("11. Supply Tracking & Deflationary Mechanics", function () {
    it("total supply decreased from burns", async function () {
      const supply = await jacobToken.totalSupply();
      expect(supply).to.be.lessThan(hre.ethers.parseEther("1000000"));
      console.log("    Current supply:", hre.ethers.formatEther(supply));
    });

    it("totalBurned tracks all burned tokens", async function () {
      const burned = await jacobToken.totalBurned();
      expect(burned).to.be.greaterThan(0);
      console.log("    Total burned:", hre.ethers.formatEther(burned));
    });

    it("supply + burned = 1M (conservation)", async function () {
      const supply = await jacobToken.totalSupply();
      const burned = await jacobToken.totalBurned();
      expect(supply + burned).to.equal(hre.ethers.parseEther("1000000"));
    });

    it("AgentMinter tracks burn stats correctly", async function () {
      const totalBurned = await agentMinter.totalTokensBurned();
      const totalMinted = await agentMinter.totalMinted();
      expect(totalBurned).to.be.greaterThan(0);
      expect(totalMinted).to.be.greaterThan(0);
      console.log("    Agents minted:", totalMinted.toString());
      console.log("    JACOB burned via minting:", hre.ethers.formatEther(totalBurned));
    });
  });

  describe("12. Token Whitelist Behavior (DN404)", function () {
    it("non-whitelisted users get internal NFTs when receiving tokens", async function () {
      const [,,,, freshUser] = await hre.ethers.getSigners();
      await jacobToken.transfer(freshUser.address, hre.ethers.parseEther("3"));
      const nftBal = await jacobToken.nftBalanceOf(freshUser.address);
      expect(nftBal).to.equal(3);
    });

    it("whitelisted addresses do NOT get internal NFTs", async function () {
      const nftBal = await jacobToken.nftBalanceOf(deployer.address);
      expect(nftBal).to.equal(0);
    });

    it("transferring tokens triggers NFT burn for non-whitelisted sender", async function () {
      const [,,,, freshUser] = await hre.ethers.getSigners();
      const nftBefore = await jacobToken.nftBalanceOf(freshUser.address);
      await jacobToken.connect(freshUser).transfer(user1.address, hre.ethers.parseEther("1"));
      const nftAfter = await jacobToken.nftBalanceOf(freshUser.address);
      expect(nftAfter).to.be.lessThan(nftBefore);
    });
  });

  describe("13. Proxy Upgrade Verification", function () {
    it("BAP578NFA has upgrader field", async function () {
      const upgrader = await bap578.upgrader();
      expect(upgrader).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("owner can set upgrader", async function () {
      await bap578.setUpgrader(user1.address);
      expect(await bap578.upgrader()).to.equal(user1.address);
      await bap578.setUpgrader("0x0000000000000000000000000000000000000000");
    });

    it("BAP578NFA has baseImageURI field", async function () {
      await bap578.setBaseImageURI("https://example.com/images/");
      const uri = await bap578.baseImageURI();
      expect(uri).to.equal("https://example.com/images/");
    });
  });
});
