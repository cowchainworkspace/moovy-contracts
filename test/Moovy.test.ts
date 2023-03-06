import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  MockToken,
  MockToken__factory,
  Moovy,
  Moovy__factory,
  MoovyTokenSale,
  MoovyTokenSale__factory
} from "../typechain";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

const FOUNDERS = '0x3567969465d2135435e9318Ac278975472F62BAE';
const ADVISORS = '0x00781266C0e25bfd385685a5F4c1c9C9D0D47cDc';
const TEAM_MEMBERS = '0xA911361263eacC9579eaA29bF14056Ee887968DF';
const KOL_REWARDS = '0xf79a429DF39E4D102d689f977C9c2d0EB4478af0';
const PLAY_TO_EARN = '0x51fF21c11845c1C83A2e9D0C35852dA84fdA84D5';
const ECOSYSTEM = '0x0bA88421c5F99184F060daB9158A4cEfBcF1F3c1';
const POOL_REWARDS = '0x4236DB10650720DefaD8dC685c8Ce3266ed2247F';
const MARKETING = '0xAA2C53096aFd874B848e420173b9f7bE4Db16107';
const PARTNERSHIP_PROGRAM = '0x1Bc24f3b9Dd264fBC764e6d2B86B950fd0A9f709';

enum AllocationGroup {
  Founders, Advisors, TeamMembers, KOLRewardsPool, PlayToEarn, EcosystemFund, PoolRewards, Marketing, Partnership
}

const increaseDate = async (days: number) => {
  await ethers.provider.send('evm_increaseTime', [days * 24 * 60 * 60]);
  await ethers.provider.send('evm_mine', []);
}
describe("Moovy", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let moovy: Moovy;
  let tokenSale: MoovyTokenSale;
  let usdt: MockToken;

  let moovy_factory: Moovy__factory;
  let tokenSale_factory: MoovyTokenSale__factory;
  let usdt_factory: MockToken__factory;

  before(async () => {
    moovy_factory = await ethers.getContractFactory("Moovy");
    tokenSale_factory = await ethers.getContractFactory("MoovyTokenSale");
    usdt_factory = await ethers.getContractFactory("MockToken");
  })

  beforeEach(async () => {
   [owner, alice, bob] = await ethers.getSigners();

   moovy = await moovy_factory.deploy();
   await moovy.deployed();

   usdt = await usdt_factory.deploy();
   await usdt.deployed();
   //
   tokenSale = await tokenSale_factory.deploy(usdt.address, moovy.address);
   await tokenSale.deployed();

   await moovy.setTokenSale(tokenSale.address);
   await moovy.setTGEPassed();
  })

  it("should mint tokens", async () => {
    expect(await moovy.totalSupply()).eq(parseEther('1000000000'))
  })

  it('should transfer tokens to token sale', async () => {
    expect(await moovy.balanceOf(tokenSale.address)).eq(parseEther('28774000'))
  })

  describe("Founders distribution", () => {
    it('should distribute cliff', async() => {
      await increaseDate(60);
      await moovy.distribute(AllocationGroup.Founders);
      expect(await moovy.balanceOf(FOUNDERS)).closeTo(parseEther('20000000'), parseEther('10'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(9 * 30);
      await moovy.distribute(AllocationGroup.Founders);
      expect(await moovy.balanceOf(FOUNDERS)).eq(parseEther('100000000'))
    })
  })

  describe("Advisors distribution", () => {
    it('should distribute cliff', async() => {
      await increaseDate(5 * 30);
      await moovy.distribute(AllocationGroup.Advisors);
      expect(await moovy.balanceOf(ADVISORS)).closeTo(parseEther('1000000'), parseEther('10'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(23 * 30);
      await moovy.distribute(AllocationGroup.Advisors);
      expect(await moovy.balanceOf(ADVISORS)).eq(parseEther('20000000'))
    })
  })

  describe("Team members distribution", () => {
    it('should distribute cliff', async() => {
      await increaseDate(4 * 30);
      await moovy.distribute(AllocationGroup.TeamMembers);
      expect(await moovy.balanceOf(TEAM_MEMBERS)).closeTo(parseEther('3000000'), parseEther('10'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(13 * 30);
      await moovy.distribute(AllocationGroup.TeamMembers);
      expect(await moovy.balanceOf(TEAM_MEMBERS)).eq(parseEther('30000000'))
    })
  })

  describe("KOL rewards distribution", () => {
    it('should distribute cliff', async() => {
      await increaseDate(12 * 30);
      await moovy.distribute(AllocationGroup.KOLRewardsPool);
      expect(await moovy.balanceOf(KOL_REWARDS)).closeTo(parseEther('3000000'), parseEther('10'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(17 * 30);
      await moovy.distribute(AllocationGroup.KOLRewardsPool);
      expect(await moovy.balanceOf(KOL_REWARDS)).eq(parseEther('30000000'))
    })
  })

  describe("Play to earn distribution", () => {
    it('should distribute cliff', async() => {
      await moovy.distribute(AllocationGroup.PlayToEarn);
      expect(await moovy.balanceOf(PLAY_TO_EARN)).closeTo(parseEther('88750000'), parseEther('100'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(6 * 30);
      await moovy.distribute(AllocationGroup.PlayToEarn);
      expect(await moovy.balanceOf(PLAY_TO_EARN)).eq(parseEther('355000000'))
    })
  })

  describe("Ecosystem fund distribution", () => {
    it('should distribute cliff', async() => {
      await moovy.distribute(AllocationGroup.EcosystemFund);
      expect(await moovy.balanceOf(ECOSYSTEM)).closeTo(parseEther('40200000'), parseEther('100'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(12 * 30);
      await moovy.distribute(AllocationGroup.EcosystemFund);
      expect(await moovy.balanceOf(ECOSYSTEM)).eq(parseEther('201000000'))
    })
  })

  describe("Pool rewards distribution", () => {
    it('should distribute pool rewards', async () => {
      await moovy.distribute(AllocationGroup.PoolRewards);
      expect(await moovy.balanceOf(POOL_REWARDS)).eq(parseEther('70000000'))
    })
  })

  describe("Marketing distribution", () => {
    it('should distribute cliff', async() => {
      await increaseDate(9 * 30);
      await moovy.distribute(AllocationGroup.Marketing);
      expect(await moovy.balanceOf(MARKETING)).closeTo(parseEther('21708900'), parseEther('100'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(36 * 30);
      await moovy.distribute(AllocationGroup.Marketing);
      expect(await moovy.balanceOf(MARKETING)).eq(parseEther('144726000'))
    })
  })

  describe("Partnership distribution", () => {
    it('should distribute cliff', async() => {
      await increaseDate(3 * 30);
      await moovy.distribute(AllocationGroup.Partnership);
      expect(await moovy.balanceOf(PARTNERSHIP_PROGRAM)).closeTo(parseEther('1025000'), parseEther('100'))
    });

    it('should distribute all tokens', async () => {
      await increaseDate(15 * 30);
      await moovy.distribute(AllocationGroup.Partnership);
      expect(await moovy.balanceOf(PARTNERSHIP_PROGRAM)).eq(parseEther('20500000'))
    })
  })

})