import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { SLTToken } from '../typechain';
import { expect } from 'chai';
import { parseEther } from "ethers/lib/utils";


const increaseDate = async (days: number) => {
    await ethers.provider.send('evm_increaseTime', [days * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);
}

describe('SLTToken', function () {
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    let SLTToken: SLTToken;

    beforeEach(async function () {
        const signers: SignerWithAddress[] = await ethers.getSigners();
        [owner, user1, user2] = signers;

        const factory = await ethers.getContractFactory('SLTToken');
        SLTToken = await factory.deploy();
        await SLTToken.deployed();
    });

    describe('addParticipants', () => {
        it('should revert if TGE is passed', async () => {
            await SLTToken.setTGEPassed();
            await expect(SLTToken.addParticipants(0, [], [])).to.be.revertedWith('Tokens were already allocated')
        })
        it('should revert if balances and participants have different length', async () => {
            await expect(SLTToken.addParticipants(0, [owner.address], [1, 1])).to.be.revertedWith("Participants and balances should have the same length")
        })
        it('should revert if no participants', async () => {
            await expect(SLTToken.addParticipants(0, [], [])).to.be.revertedWith("There should be at least one participant")
        })
        it('should add participants', async () => {
            await SLTToken.addParticipants(0, [owner.address, user1.address], [0, 0])
            const prt = await SLTToken.getGroup(0);
            expect(prt.length).to.eq(2);
        })
    })

    describe('removeParticipants', () => {
        beforeEach(async () => {
            await SLTToken.addParticipants(0, [owner.address, user1.address], [0, 0])
        })
        it('should not remove if tokens already allocated', async () => {
            await SLTToken.setTGEPassed();
            await expect(SLTToken.removeParticipant(0, owner.address)).to.be.revertedWith("Tokens were already allocated")
        })
        it('should remove participant', async () => {
            await SLTToken.removeParticipant(0, owner.address);
            const prt = await SLTToken.getGroup(0);
            expect(prt).to.not.include(owner.address)
        })
    })

    describe('setTGEPassed', () => {
        beforeEach(async () => {
            await SLTToken.addParticipants(0, [owner.address, user1.address], [0, 0])
            await SLTToken.setTGEPassed();
        })
        it("should not set TGE passed if already set", async () => {
            await expect(SLTToken.setTGEPassed()).to.be.revertedWith("TGE is already passed");
        })
        it("should set TGE timestamp", async () => {
            expect(await SLTToken.TGETimestamp()).to.be.above(0)
        })
    })

    describe('distribute', () => {
        beforeEach(async () => {
            await SLTToken.addParticipants(0, [owner.address, user1.address], [ethers.utils.parseEther('10'), ethers.utils.parseEther('10')])
            await SLTToken.setTGEPassed();
        })
        it("should not distribute if cliff not passed", async () => {
            await expect(SLTToken.distribute(0)).to.be.revertedWith("Distribution is not started yet")
        })
        it("should distribute", async () => {
            await increaseDate(6 * 30);
            await SLTToken.distribute(0);
            expect(await SLTToken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther("0"));
            await increaseDate(3 * 30);
            await SLTToken.distribute(0);
            expect(await SLTToken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther((10 * 12.5 / 100).toString()));
        })
        it("should revert if too early", async () => {
            await increaseDate(6 * 30);
            await SLTToken.distribute(0);
            await increaseDate(2 * 30);
            await expect(SLTToken.distribute(0)).to.be.revertedWith("It's too early for distribution")
        })

        it("should revert if distribution is passed", async () => {
            await increaseDate(6 * 30);
            await SLTToken.distribute(0);
            for (let i = 0; i < 8; i++) {
                await increaseDate(3 * 30);
                await SLTToken.distribute(0);
            }
            await expect(SLTToken.distribute(0)).to.be.revertedWith("Distribution is already passed")
        })
    })

    describe('Claim', () => {
        beforeEach(async () => {
            await SLTToken.addParticipants(0, [owner.address, user1.address], [ethers.utils.parseEther('10'), ethers.utils.parseEther('10')])
            await SLTToken.setTGEPassed();
        })
        it("should not claim if cliff is not passed", async () => {
            await expect(SLTToken.claim(0)).to.be.revertedWith("You cannot claim")
        })
        it("should claim after cliff", async () => {
            await increaseDate(6 * 30);
            await expect(SLTToken.claim(0)).not.to.be.revertedWith("You cannot claim")
        })
    });

    describe('distribute', () => {
        beforeEach(async () => {
            await SLTToken.addParticipants(0, [owner.address, user1.address], [ethers.utils.parseEther('10'), ethers.utils.parseEther('10')])
            await SLTToken.setTGEPassed();
            await increaseDate(6 * 30);
            await SLTToken.distribute(0);
            for (let i = 0; i < 8; i++) {
                await increaseDate(3 * 30);
                await SLTToken.distribute(0);
            }
            await SLTToken.setMainnetLaunched();
        })
    })
});
