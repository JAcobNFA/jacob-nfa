const { ethers } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deployer:', deployer.address);

    const MINTER_ADDRESS = '0xb053397547587fE5B999881e9b5C040889dD47C6';
    const OFFICIAL_BAP578 = '0xd7deb29ddbb13607375ce50405a574ac2f7d978d';
    const AGENT_LOGIC = '0x1017CD09a86D92b4CBe74CD765eD4B78Ea82a356';
    const BASE_METADATA_URI = '';

    const MINTER_ABI = [
        'function setOfficialBAP578(address) external',
        'function setAgentLogicAddress(address) external',
        'function setBaseMetadataURI(string) external',
        'function setOfficialRegistrationEnabled(bool) external',
        'function registerExistingAgentBatch(uint256[], address[], uint8[], uint256[]) external',
        'function officialRegistrationEnabled() view returns (bool)',
        'function officialBAP578() view returns (address)',
        'function agentLogicAddress() view returns (address)',
        'function localToOfficialId(uint256) view returns (uint256)',
        'function totalOfficiallyRegistered() view returns (uint256)',
        'function owner() view returns (address)'
    ];

    const minter = new ethers.Contract(MINTER_ADDRESS, MINTER_ABI, deployer);

    const owner = await minter.owner();
    console.log('Contract owner:', owner);
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error('ERROR: Deployer is not the contract owner!');
        process.exit(1);
    }

    console.log('\n--- Step 1: Set Official BAP578 Registry Address ---');
    const currentOfficial = await minter.officialBAP578();
    if (currentOfficial.toLowerCase() === OFFICIAL_BAP578.toLowerCase()) {
        console.log('Already set to:', OFFICIAL_BAP578);
    } else {
        const tx1 = await minter.setOfficialBAP578(OFFICIAL_BAP578);
        console.log('TX:', tx1.hash);
        await tx1.wait();
        console.log('Set officialBAP578 to:', OFFICIAL_BAP578);
    }

    console.log('\n--- Step 2: Set Agent Logic Address ---');
    const currentLogic = await minter.agentLogicAddress();
    if (currentLogic.toLowerCase() === AGENT_LOGIC.toLowerCase()) {
        console.log('Already set to:', AGENT_LOGIC);
    } else {
        const tx2 = await minter.setAgentLogicAddress(AGENT_LOGIC);
        console.log('TX:', tx2.hash);
        await tx2.wait();
        console.log('Set agentLogicAddress to:', AGENT_LOGIC);
    }

    console.log('\n--- Step 3: Enable Official Registration ---');
    const isEnabled = await minter.officialRegistrationEnabled();
    if (isEnabled) {
        console.log('Already enabled');
    } else {
        const tx3 = await minter.setOfficialRegistrationEnabled(true);
        console.log('TX:', tx3.hash);
        await tx3.wait();
        console.log('Official registration enabled!');
    }

    console.log('\n--- Step 4: Register Existing 8 Agents ---');
    const localTokenIds = [1, 2, 3, 4, 5, 6, 7, 8];
    const agentOwners = [
        '0x52aCC7E3C801aAd37521750237356c68ffb99F8A',
        '0x52aCC7E3C801aAd37521750237356c68ffb99F8A',
        '0x52aCC7E3C801aAd37521750237356c68ffb99F8A',
        '0x52aCC7E3C801aAd37521750237356c68ffb99F8A',
        '0x03bc2006a30a7848696266905991BF6826C8a74a',
        '0x52aCC7E3C801aAd37521750237356c68ffb99F8A',
        '0x03bc2006a30a7848696266905991BF6826C8a74a',
        '0x52aCC7E3C801aAd37521750237356c68ffb99F8A'
    ];
    const tiers = [1, 1, 1, 2, 1, 3, 1, 2];
    const burnedAmounts = [
        ethers.parseEther('10'),
        ethers.parseEther('10'),
        ethers.parseEther('10'),
        ethers.parseEther('50'),
        ethers.parseEther('10'),
        ethers.parseEther('250'),
        ethers.parseEther('10'),
        ethers.parseEther('50')
    ];

    const alreadyRegistered = await minter.localToOfficialId(1);
    if (alreadyRegistered > 0n) {
        console.log('Agents already registered! First agent official ID:', alreadyRegistered.toString());
    } else {
        const tx4 = await minter.registerExistingAgentBatch(
            localTokenIds,
            agentOwners,
            tiers,
            burnedAmounts,
            { gasLimit: 3000000 }
        );
        console.log('TX:', tx4.hash);
        const receipt = await tx4.wait();
        console.log('Batch registration confirmed in block:', receipt.blockNumber);
    }

    console.log('\n--- Verification ---');
    const totalReg = await minter.totalOfficiallyRegistered();
    console.log('Total officially registered:', totalReg.toString());

    for (let i = 1; i <= 8; i++) {
        const officialId = await minter.localToOfficialId(i);
        console.log('Local ID', i, '-> Global Registry ID:', officialId.toString());
    }

    console.log('\nDone! All agents are now registered on the global NFA Registry.');
    console.log('Future mints will automatically register on the global registry too.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
