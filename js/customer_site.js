const CUSTOMER_SITES = {
    ffzy: {
        api: 'https://cj.ffzyapi.com/api.php/provide/vod',
        name: '非凡资源',
    },
    ysgc: {
        api: 'https://cj.lziapi.com/api.php/provide/vod',
        name: '影视工厂',
    },
    jszy: {
        api: 'https://jszyapi.com/api.php/provide/vod',
        name: '极速资源',
    },
    wujin: {
        api: 'https://api.wujinapi.com/api.php/provide/vod',
        name: '无尽资源',
    },
    maoyan: {
        api: 'https://api.maoyanapi.top/api.php/provide/vod',
        name: '猫眼资源',
    },
    rycj: {
        api: 'https://cj.rycjapi.com/api.php/provide/vod',
        name: '如意资源',
    },
    huya: {
        api: 'https://www.huyaapi.com/api.php/provide/vod',
        name: '虎牙资源',
    },
    xinlang: {
        api: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod',
        name: '新浪资源',
    },
    wolong: {
        api: 'https://wolongzyw.com/api.php/provide/vod',
        name: '卧龙资源',
    },
    dbzy: {
        api: 'https://dbzy.tv/api.php/provide/vod',
        name: '豆瓣资源',
    },
    mdzy: {
        api: 'https://www.mdzyapi.com/api.php/provide/vod',
        name: '魔都资源',
    },
    zuid: {
        api: 'https://api.zuidapi.com/api.php/provide/vod',
        name: '最大资源',
    },
    baidu: {
        api: 'https://api.apibdzy.com/api.php/provide/vod',
        name: '百度云资源',
    },
    ikun: {
        api: 'https://ikunzyapi.com/api.php/provide/vod',
        name: 'iKun资源',
    },
    guangsu: {
        api: 'https://api.guangsuapi.com/api.php/provide/vod',
        name: '光速资源',
    },
    jinying: {
        api: 'https://jinyingzy.com/api.php/provide/vod',
        name: '金鹰资源',
    },
    hongniu: {
        api: 'https://www.hongniuzy2.com/api.php/provide/vod',
        name: '红牛资源',
    },
    hhzy: {
        api: 'https://hhzyapi.com/api.php/provide/vod',
        name: '豪华资源',
    },
    p2100: {
        api: 'https://p2100.net/api.php/provide/vod',
        name: '飘零资源',
    },
    uku: {
        api: 'https://api.ukuapi88.com/api.php/provide/vod',
        name: 'U酷资源',
    },
    ckzy: {
        api: 'https://www.ckzy1.com/api.php/provide/vod',
        name: 'CK资源',
        adult: true,
    },
    jkun: {
        api: 'https://jkunzyapi.com/api.php/provide/vod',
        name: 'jKun资源',
        adult: true,
    },
    bwzy: {
        api: 'https://api.bwzyz.com/api.php/provide/vod',
        name: '百万资源',
        adult: true,
    },
    r155: {
        api: 'https://155api.com/api.php/provide/vod',
        name: '155资源',
        adult: true,
    },
    huangcang: {
        api: 'https://hsckzy.vip/api.php/provide/vod',
        name: '黄色仓库',
        adult: true,
    },
    yutu: {
        api: 'https://yutuzy10.com/api.php/provide/vod',
        name: '玉兔资源',
        adult: true,
    },
    siwa: {
        api: 'https://siwazyw.tv/api.php/provide/vod',
        name: '丝袜资源',
        adult: true,
    }
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
