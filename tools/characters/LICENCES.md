# Licences of the shipped characters

Every file in this folder that is not our own is CC0 1.0 (public domain dedication,
https://creativecommons.org/publicdomain/zero/1.0/). Credit is not required; it is kept here
because the owner asked for it. Written by tools/characters/manifest.cjs: do not edit by hand.

## Sources

- **KayKit - Character Pack: Adventurers 2.0 (Free)**, by Kay Lousberg (www.kaylousberg.com)
  - Page: https://kaylousberg.itch.io/kaykit-adventurers (licence shown there: Creative Commons Zero v1.0 Universal)
  - Downloaded: 2026-10-21; archive SHA-256 abe48f4763fba0896bab486ee9e6d08ca6b5b3884b9601f235c8847ae94dc479
  - Licence text, as it came in the pack: `licences/KayKit-Adventurers-License.txt`
- **KayKit - Character Animations 1.1**, by Kay Lousberg (www.kaylousberg.com)
  - Page: https://kaylousberg.itch.io/kaykit-character-animations (licence shown there: Creative Commons Zero v1.0 Universal)
  - Downloaded: 2026-10-21; archive SHA-256 65882f31f905ad2e953819648a59287cdeab8f623908d5ef701971d3758be20f
  - Licence text, as it came in the pack: `licences/KayKit-Character-Animations-License.txt`

Our own script made `default.glb` (CC0, see LICENSE.txt). The sprites and portraits are rendered from the
models below by build-sprites.cjs, so they carry the same licence and the same authors.

## What was changed

- costume props left out (capes, hats, helmets, quiver, masks, weapons)
- outfit recoloured: neutral shirt (tinted by the page), plain dark trousers and shoes; face and hair kept
- atlas texture baked into vertex colours
- merged with the shared Rig_Medium animation set; six clips kept and renamed Idle, Walk, Sit, Typing, Stand, Celebrate
- Typing synthesised from Simulation:Sit_Chair_Idle with a keyboard arm motion
- asset.generator set to "Arsenale character build"

## Models

| File | Source file (original SHA-256) | SHA-256 | Bytes |
|---|---|---|---:|
| default.glb | own script (make-default-character.cjs) | af371aa023aaece5720da941d2db15d188be33d68b39d7794edc722d38c355e6 | 91292 |
| person-1.glb | kaykit-adventurers: Characters/gltf/Rogue.glb (cae5d9b2f08d53f7b4ab2617d9f42f021c546eb10920455fdcd82a110867fae4) | cd53f370e619537daacf0501db1e5ca140f6bdce5f0e227493fc8109ab8c6563 | 486776 |
| person-2.glb | kaykit-adventurers: Characters/gltf/Ranger.glb (3a0b0166b9d61d58dcaaa739c3cc0538be46e00d2928dd5cb513d9a41770d2e9) | 8e4de07fb85ebc6ad88eb5e7d580dc789826eb356fb85c18a47a953009575342 | 534024 |
| person-3.glb | kaykit-adventurers: Characters/gltf/Mage.glb (1f7d891bde50b879c70965f155b7b765b166dc3f8518e5abb86c0002f191a26e) | 431791664d7479ddc5cd7f14d044858c7e393edaefc36cef96a6c225fcc53548 | 421880 |
| person-4.glb | kaykit-adventurers: Characters/gltf/Barbarian.glb (d37824a1d6e8e8af57ef9ae4a87e9271c3986210fbc432fb44670749a577ccac) | 04d93d6027fdf1cdcff78f0400499d45dd02b42deef9a8cafd3f258ca0c48f8a | 422060 |
| person-5.glb | kaykit-adventurers: Characters/gltf/Knight.glb (e484370733824a0740683e7f6040aae0d20e5efd4107dde1175d6a2ad7e2f199) | 13cb359c215d6dd20845b6bb0e3451fa4af10e326da16aa57eefd3536d63401d | 380488 |
| person-plain.glb | kaykit-character-animations: Mannequin Character/characters/Mannequin_Medium.glb (368a4c0733280bc810c004b81f31408f43c00e307cf914061e80f192ba25685b) | b6c44e6b10ce47480e31388e6801d76001bcd0c51cba466f2b8ea198afe1e3df | 489492 |

## Animation files the clips come from (kaykit-character-animations)

| Source file | SHA-256 |
|---|---|
| Animations/gltf/Rig_Medium/Rig_Medium_General.glb | 5f725c0f745f36078c7238968cd5c04843cbc6260689eb6e7f5e2bbd7ffdd7ad |
| Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb | 11422afd50abf7e8c92ea107e2e0bc94abd38023d6d15f55ad580347efbfa29e |
| Animations/gltf/Rig_Medium/Rig_Medium_Simulation.glb | ab6ffeed40c8281dd0ce0506534eadf7385151f1c266643a10fa2a0f0a7ba3b1 |

## Rendered images (sprites/)

| File | Kind | Rendered from | SHA-256 | Bytes |
|---|---|---|---|---:|
| sprites/atlas.json | atlas | sprites/ | 366c28ef31a821e29d5c58267a99e4d9a534a4ed49c66b40dfbcd0fa72e40ed5 | 497 |
| sprites/p-1-amber.webp | portrait | person-1.glb | 6b04527b068d3af4442f7a43d278b370a9b44d4eb5530ab75f85478c984ef5d3 | 8044 |
| sprites/p-1-blue.webp | portrait | person-1.glb | 082607ce4451664f070d245f78566264afe2b1ad7694a133a04a3e0c584c55e8 | 8440 |
| sprites/p-1-coral.webp | portrait | person-1.glb | 62e3ccbb5235ee19777c25081cb1fe83ab5b36f80a0d5caddc5ce1994c226ea3 | 7996 |
| sprites/p-1-cyan.webp | portrait | person-1.glb | 629f39f1c812029a4918828394326c71a587514634ff5d412438fb09f9437b4e | 8296 |
| sprites/p-1-green.webp | portrait | person-1.glb | 88f1a0f6e5235c7c503deb7b3f3a543d78c4c25dfeedf18317e99ed39be7f3d0 | 7900 |
| sprites/p-1-pink.webp | portrait | person-1.glb | 0f76e44757decc1182dd580980c199165bfddf7435205ee50356cadd0e9e1a7f | 7972 |
| sprites/p-1-slate.webp | portrait | person-1.glb | 363c780f02c7f59c47ce04e9920784d6a5c6ad006665f898f8028f5c1fd44a29 | 7998 |
| sprites/p-1-teal.webp | portrait | person-1.glb | 58bbf4b972e38db1148d8a36490847d82bfdea956d8469bbefe880b0d04f86a2 | 8100 |
| sprites/p-1-violet.webp | portrait | person-1.glb | 55d97ffb4026ee9a7fbaff2f871c970ab6b4530149b177de3a89df52ed27113f | 8150 |
| sprites/p-2-amber.webp | portrait | person-2.glb | c19c6a41527b0ad52ce5771b42fc57e71043f0e0df81f36e307f7b8929508d1d | 7882 |
| sprites/p-2-blue.webp | portrait | person-2.glb | caf572aa59db68750c7a8521de0e7646ae1b3db035f66e9ce4c73f94661d9c16 | 8340 |
| sprites/p-2-coral.webp | portrait | person-2.glb | ed867a5c9bc02b2163b02026b315b4c5efaef920468fcb79ffbc74083bf63a0f | 7876 |
| sprites/p-2-cyan.webp | portrait | person-2.glb | ff79dc4665bd54770ac72c033b8d3575d10ce9d4bb2fd4448ce2be2afc0ae73b | 8198 |
| sprites/p-2-green.webp | portrait | person-2.glb | fbb5415f987e002eb7f96ddcaa6678b4a04e83ddfad6d7e60a05a24c45953672 | 7860 |
| sprites/p-2-pink.webp | portrait | person-2.glb | a8280ca007efda138710fa0f24deeec6bedfb890c194b7fecd1b73e20a50f0bc | 7966 |
| sprites/p-2-slate.webp | portrait | person-2.glb | 408959c16f4a66e4766f048f2614783fb63711fefb3decff1969efd44a71a0d4 | 7592 |
| sprites/p-2-teal.webp | portrait | person-2.glb | 1e7c3030e17d86de9e553a4620f2bc133a61ec779164404b495537ffe6b524a5 | 7958 |
| sprites/p-2-violet.webp | portrait | person-2.glb | ef328a33fe3e0589a20d15aec46269a26e1ae69f3e94c0b453be87bb021c92f2 | 7984 |
| sprites/p-3-amber.webp | portrait | person-3.glb | 96e3ce35405135c05e27712ca10f10e19f2ce414fcc9be2958a9448f40857284 | 9258 |
| sprites/p-3-blue.webp | portrait | person-3.glb | 4b596ccea7297172b5ad5996b42edc2a47dccf96ea9696fd6d0a143bf9dedeb0 | 9452 |
| sprites/p-3-coral.webp | portrait | person-3.glb | 0983bb5753fe6e5ed6201609a4a9e0d636f1fe7fc0f7e70cd70d1589d8e115ff | 9244 |
| sprites/p-3-cyan.webp | portrait | person-3.glb | e0adaa84f4f27779002b05477881aa1917135607c8aaec1540b7a1417aa662b4 | 9362 |
| sprites/p-3-green.webp | portrait | person-3.glb | 583dd0bde8eaf41119fd1c512c7ceb18889209bc3b64b805b68220f360d3c77f | 8916 |
| sprites/p-3-pink.webp | portrait | person-3.glb | 93900c750e95cbec829e0ee81fd953234343d23b19a39f5915700ba6d834a332 | 9088 |
| sprites/p-3-slate.webp | portrait | person-3.glb | cac79a389606133904d0bcc7a2483aa85f3e969f070e5a0128a9d724ed9ad571 | 8820 |
| sprites/p-3-teal.webp | portrait | person-3.glb | 6e1151b809f54e7494ec7c04238f027d64ed08fd106bee0a889938aeba34b72c | 9110 |
| sprites/p-3-violet.webp | portrait | person-3.glb | b81774ea55c4f8f62a0fc2d74bcb394fa657a97ef5dc43a5d0b5b17f5a47c758 | 9072 |
| sprites/p-4-amber.webp | portrait | person-4.glb | 6eb46b48deb650e6b6a6499132e36efaf1da7eb61b1b5ffad8c2d3037f4f84bf | 8752 |
| sprites/p-4-blue.webp | portrait | person-4.glb | e6895a06952b008d087945f40e116b55eb65ff20bd3c65218347f4db702a33d0 | 8964 |
| sprites/p-4-coral.webp | portrait | person-4.glb | ad65c1386f21a4d84a2a6f834c0be49eda50f2aef4567e4da101bd6e618a5b77 | 8630 |
| sprites/p-4-cyan.webp | portrait | person-4.glb | 3f0d6c0bd994bc404a636026529b6a011c6f7201bfdb4d9e2fab58f739ac1a39 | 8872 |
| sprites/p-4-green.webp | portrait | person-4.glb | 10eb693d41a1ad6945256630535730f81b5ce0af9ba6da0eb399230ad3e46672 | 8548 |
| sprites/p-4-pink.webp | portrait | person-4.glb | 6830d51ab23ca5819095ebdf38f6ce2c90a76e470781fac3f5b40f46738cd711 | 8686 |
| sprites/p-4-slate.webp | portrait | person-4.glb | 68344e75f53e9d4b5ff69c923ea5880809f689b621d39452e70e0b641a91cd84 | 8446 |
| sprites/p-4-teal.webp | portrait | person-4.glb | eb1f3d86293b4114d1423d5561fe8366ed229f6ae169e15f94eafcaef52b3e08 | 8482 |
| sprites/p-4-violet.webp | portrait | person-4.glb | e96735a7b6bd6ecb299e19e8e8e1d37f6310d8defea30608d0606954c3de9198 | 8662 |
| sprites/p-5-amber.webp | portrait | person-5.glb | 73d123f25fab7cf35ea3a19376aa99987283400af05f54ec04628af32390add0 | 7412 |
| sprites/p-5-blue.webp | portrait | person-5.glb | be4879f17d473c4d51ba9302fd1da84cd49dcabe330a5a2dd4d69749fecd0ebb | 7556 |
| sprites/p-5-coral.webp | portrait | person-5.glb | 1f686960a97fba88c788c7ff7683f9f1c9746b880a878d59b1b578710ca7adae | 7360 |
| sprites/p-5-cyan.webp | portrait | person-5.glb | 5e84dfeea63f67fdd0cc1c8578579158f7189deceb39bfbce2df77fea56f0376 | 7470 |
| sprites/p-5-green.webp | portrait | person-5.glb | 7b908dbd5394622bd1cecc650cbd3168f3e7313bdd3e476470e7b6a7d7cd6bf0 | 7020 |
| sprites/p-5-pink.webp | portrait | person-5.glb | b33e62ef9d6a15cd29905851d339b92aac4e73f052204fd03c6d74660e13adb1 | 7240 |
| sprites/p-5-slate.webp | portrait | person-5.glb | 145b32ae69b4489103c9234ddb66303eb53659a4c567659fbb3d32eea5d3f163 | 7044 |
| sprites/p-5-teal.webp | portrait | person-5.glb | 3898c8f720ddfcf7fbbfc074ea245eda1296f8a74535f8a4287e316ab2a9154e | 7170 |
| sprites/p-5-violet.webp | portrait | person-5.glb | 04559d401f43ca90696d31a16a3b8b923b2f4a1581267060cab4d27374a9a9e4 | 7180 |
| sprites/p-plain-amber.webp | portrait | person-plain.glb | a4d76b93aef9e58c87d326200a097ed2918f1af0adbce8619412f0bb1b806e6f | 7448 |
| sprites/p-plain-blue.webp | portrait | person-plain.glb | f9d6cf5c505d8b0c9fc199430e19160213a0d90f721686c68be738a30dd8749d | 7382 |
| sprites/p-plain-coral.webp | portrait | person-plain.glb | dcc59c670fb2730ec66d2b6b486c2bd76bd17f7c1b2ccc85c3389bc3dc679d84 | 7376 |
| sprites/p-plain-cyan.webp | portrait | person-plain.glb | 8bf5e07ce541a2c053c50b27013d52f8a801a3f1e312b4c9eb408a0f16ec81cc | 7308 |
| sprites/p-plain-green.webp | portrait | person-plain.glb | 602c90d31ed09271652a784eec6a71859cb827a572d86fb9393bb139ef2ebfda | 7102 |
| sprites/p-plain-pink.webp | portrait | person-plain.glb | 9c82b69b21c427a2e761155fc0e6783b32d8dfc30127583f5056a9613962cf82 | 7232 |
| sprites/p-plain-slate.webp | portrait | person-plain.glb | 0fb93ffcc0906127ad048e5772d669e20b5dea0e75345f10d8f1189689ba1397 | 6986 |
| sprites/p-plain-teal.webp | portrait | person-plain.glb | 25a8221e5521b1b33e8a99edfb7f90e10f12670cf1b97b441959dbdd97c1f2c4 | 7052 |
| sprites/p-plain-violet.webp | portrait | person-plain.glb | f533c8ccbc1de108dcda8cda579184949cfd429873efc79bed0998af630c679b | 7250 |
| sprites/s-1-amber.webp | sprite | person-1.glb | 98b9aab79dcdd2d77e63e31da9583233d5d4566b26c5c29d69ab57a25416fe3b | 9372 |
| sprites/s-1-blue.webp | sprite | person-1.glb | 6dc60713b78d09a9a4d99d7c20b65df823be5c9523b859388534673f1d406e50 | 9370 |
| sprites/s-1-coral.webp | sprite | person-1.glb | 430704d38b3227b70cf28bbb7f78b9bd828fd65e78c00a75400f259632af9cec | 9344 |
| sprites/s-1-cyan.webp | sprite | person-1.glb | dd2d1fe6d31b38d0fb2eb010a2e33a43e46c9d165c8dbc2a965aa324a20aa3d6 | 9324 |
| sprites/s-1-green.webp | sprite | person-1.glb | fe1e97da1435e06be43752ce9fc9f0731a5579f53f6d29dd56e8067fda5149c4 | 9256 |
| sprites/s-1-pink.webp | sprite | person-1.glb | afd196d0887ae4c0f89315dc171e1a2a53ab59560a7dfe82cb1720f899d38a2a | 9254 |
| sprites/s-1-slate.webp | sprite | person-1.glb | 7ea4a3b2922abd6bb0592d88a3604553ce6e025c87b98196e53d9b0dbc7a745b | 9264 |
| sprites/s-1-teal.webp | sprite | person-1.glb | 32b52e3541f1dd7b49d1e907ef59bba46673241c271b4ffca8695cc849a4d53d | 9234 |
| sprites/s-1-violet.webp | sprite | person-1.glb | 8218583ce1c1947cc861429b1db5e56e9e4ff5fdddadafe997d90d9009e63af0 | 9250 |
| sprites/s-2-amber.webp | sprite | person-2.glb | ac18a9c79a43c0ec09944f1664d51917988abd17bba907267bcdb032227c4a3f | 8176 |
| sprites/s-2-blue.webp | sprite | person-2.glb | aeffb685b32ab34c76c81a079727ab4ce56981d54342cedfb172512a80540277 | 8270 |
| sprites/s-2-coral.webp | sprite | person-2.glb | 8ad0dafe4e508e47514578d287e2ebde7cda8814729d7bbc1454e0982328617c | 8276 |
| sprites/s-2-cyan.webp | sprite | person-2.glb | ebaf24b2085e54891a825db62e0c2079b1cf60259eeadb4411e7c7001d8c32bf | 8200 |
| sprites/s-2-green.webp | sprite | person-2.glb | 812f2c7b38b2bd2637b38bbee4a6e4a0a445f191850fb8facec95f2dba291ced | 8182 |
| sprites/s-2-pink.webp | sprite | person-2.glb | f1f4d6b42220f73672f82926acede1899ba4166fd98b54754c345a968deba89d | 8170 |
| sprites/s-2-slate.webp | sprite | person-2.glb | 7663d748ff7a42df813f357f5564bc028acd687ec51f8f83fa12673fa700f080 | 8190 |
| sprites/s-2-teal.webp | sprite | person-2.glb | b121852894c28e0a828abc3f6fac0c8e7ee1457d46222bfc7a0da1d99a53fedf | 8200 |
| sprites/s-2-violet.webp | sprite | person-2.glb | 24f350b2b314747370a06355d6c515b76359d834730cfffaaed67de6e8a8eea0 | 8196 |
| sprites/s-3-amber.webp | sprite | person-3.glb | f3cafb081350a62e33d2723b66940a04914892de4270919137793f6975b6ddb9 | 9056 |
| sprites/s-3-blue.webp | sprite | person-3.glb | 26c7e92488ec31dc882bbde5cb5df1d04f9e7075772da5f7dbf5c481fe440fdc | 9014 |
| sprites/s-3-coral.webp | sprite | person-3.glb | aa66e6073e417e990d28b06328411adf9271652bbc9b7a0b85235b3422e8469c | 9058 |
| sprites/s-3-cyan.webp | sprite | person-3.glb | 1762f71a5de2490b2c991c2f78122d4567ff46bacf0dc04369fae04fc5ad076a | 9030 |
| sprites/s-3-green.webp | sprite | person-3.glb | 5e83e27ae26eb8acf60cd059f7da6bf18cb615a6b565f9a76ba9f70563b88cc5 | 8926 |
| sprites/s-3-pink.webp | sprite | person-3.glb | 769fae99bf3b3e4f8765eb163b82ba007f8863b54edbd761c200f5b8b291fbd6 | 8942 |
| sprites/s-3-slate.webp | sprite | person-3.glb | ae13a139a9df306db10c2ed0d078e63720b16655e08d75e1be568a135753821e | 8782 |
| sprites/s-3-teal.webp | sprite | person-3.glb | 4dac4c343a7c873d00335e6d39d3540aadfee8ad88cf84272ea1f45eb3b3beee | 8846 |
| sprites/s-3-violet.webp | sprite | person-3.glb | 4aec919ef0793e60a8ffabd027f077496c89ed75fde8b4a41c75713faff7c1bf | 8884 |
| sprites/s-4-amber.webp | sprite | person-4.glb | a2c9236b700453425e2f5a9cdc5a4baeed18b0ad7d61d06510f6a1d32b5b1d30 | 8832 |
| sprites/s-4-blue.webp | sprite | person-4.glb | 5523740db4a88728d73a6d45c4e9c83e3b986b6c85ac2fac0838f68dc0849b49 | 8766 |
| sprites/s-4-coral.webp | sprite | person-4.glb | 2d1edccef359f7a46ccf9d84928adb38822905fb160205a5034e2b40f71fc2cb | 8784 |
| sprites/s-4-cyan.webp | sprite | person-4.glb | 86140404f8a2940f41f100efe2ad7390057c8afc4182147c1121857cef25dd77 | 8750 |
| sprites/s-4-green.webp | sprite | person-4.glb | 68952d04801865c27f1471833655e9907df7d7d8e501e1aaa12925fa1e97e962 | 8624 |
| sprites/s-4-pink.webp | sprite | person-4.glb | 077714bff523926608f98c61b1d6e465ca9843d1ec8d172c98897f28337aa1e5 | 8686 |
| sprites/s-4-slate.webp | sprite | person-4.glb | d77252ab610d8040c272c37e14ffe89c9db182d5abb18312384449712a376e0e | 8698 |
| sprites/s-4-teal.webp | sprite | person-4.glb | 2a6f751427a84d049d270d4f0a5566ad4388ebaea84b33335205ef9ee6ed90ee | 8616 |
| sprites/s-4-violet.webp | sprite | person-4.glb | 79c63a078d786a636794269c158a1cbc6d6de4e654f2057df9bf6ced1523b97b | 8762 |
| sprites/s-5-amber.webp | sprite | person-5.glb | 2c6bcea757eb80ad44b87e7b7b6377ff672ec4141daa7190de97c4ce58341805 | 7550 |
| sprites/s-5-blue.webp | sprite | person-5.glb | a1cbc2701386ae1fc3449bc27f7963e63584af8d92dc7b22e4857258229d5ab1 | 7902 |
| sprites/s-5-coral.webp | sprite | person-5.glb | 468c19c92da393083019c7a1a7080ab8bef1941cefe65dd60c43494e3de753bf | 7682 |
| sprites/s-5-cyan.webp | sprite | person-5.glb | ba173852ea8e85db1b55d09b9ed1e9c3db9d929ea6063f042a085269eae8e7cd | 7854 |
| sprites/s-5-green.webp | sprite | person-5.glb | 0d8b871e35dd82c350e151acb6200df3c7163b7f50aa580bdac487f5662dea9f | 7666 |
| sprites/s-5-pink.webp | sprite | person-5.glb | 912468436eac45941bc24cebb50ca65b57616642756e6262f89d88f7fede88e3 | 7776 |
| sprites/s-5-slate.webp | sprite | person-5.glb | df17373fca46437af56184a97a01948d6369096b0b464ab37b42fe29ea45b0c7 | 7694 |
| sprites/s-5-teal.webp | sprite | person-5.glb | 71381b359c68ab3160a976805f9cb58b35d422ca64a65c88f4499106068559d8 | 7760 |
| sprites/s-5-violet.webp | sprite | person-5.glb | d53bef33fc8363a9d104e0a0d8f28401b97e5935cebc89f21adf4c885f4076eb | 7782 |
| sprites/s-plain-amber.webp | sprite | person-plain.glb | d391b14555d8d61f1a3479886033d313e501c98a59b358152d70747f07894e2f | 7192 |
| sprites/s-plain-blue.webp | sprite | person-plain.glb | 362fb7a96651e0e793c234ca6014855d73e0cc255f938e4965cb8adf9287f4ae | 7094 |
| sprites/s-plain-coral.webp | sprite | person-plain.glb | 693bd94efae3b48055002e1c4ed19355dfd387ff27f2dc38fe2c739be4fc737f | 7178 |
| sprites/s-plain-cyan.webp | sprite | person-plain.glb | 172d47e6ac1de22781e701334caf576a9ad9f44ad98b393e0b316d0524da95fc | 7132 |
| sprites/s-plain-green.webp | sprite | person-plain.glb | 4f2deadc5edcc8865ad4c0aed693dc7c12178cc6008f22645b323a6e2aef83c1 | 6988 |
| sprites/s-plain-pink.webp | sprite | person-plain.glb | 7a0df08c1c0038d87254a55074ecf13b07b82007f4e1c694b6f80fd997e97e85 | 6976 |
| sprites/s-plain-slate.webp | sprite | person-plain.glb | 6097db0c9ed014c2f5f3d898022dd100054b94d40ed9357abb48aa3631d06ca2 | 6598 |
| sprites/s-plain-teal.webp | sprite | person-plain.glb | 459e5f2f2d2a4e109e27fd6397065788fc38748224b208d5931560ac799f0fb4 | 6852 |
| sprites/s-plain-violet.webp | sprite | person-plain.glb | df9e6826b3667ecabe92073c4204153d5d4dc4cf92f83bbf975061d9a7c1ee52 | 6928 |
