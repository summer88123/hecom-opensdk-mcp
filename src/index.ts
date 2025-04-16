import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import HClient, { ObjectMeta } from 'hecom-openapi';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.error('dirname', __dirname);
const server = new McpServer({
    name: 'hecom',
    version: '0.0.1',
    capabilities: {
        resources: {},
        tools: {},
    },
});
const hecom = new HClient({
    clientId: process.env.HECOM_CLIENT_ID || '',
    clientSecret: process.env.HECOM_CLIENT_SECRET || '',
    username: process.env.HECOM_USERNAME || '',
    apiHost: process.env.HECOM_HOST || '',
});

server.tool('get-objects', '获取可用的对象列表', async () => {
    const objects = await hecom.getObjects();

    if (!objects || objects.length === 0) {
        return {
            content: [
                {
                    type: 'text',
                    text: '没有可用的对象列表',
                },
            ],
        };
    }

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(
                    objects
                        .filter(o => o.label.length > 5)
                        .map((obj: ObjectMeta) => ({
                            label: obj.label,
                            name: obj.name,
                            description: obj.description,
                        }))
                ),
            },
        ],
    };
});

server.tool(
    'get-object-desc',
    '获取对象的描述，包括对象bizType列表和field列表，如果用户提到了具体的对象，始终应该先调用这个工具来获取对象的描述',
    { label: z.string().describe(''), name: z.string().describe('对象name') },
    async ({ name }) => {
        const object = await hecom.getObjectDescription(name);

        if (!object) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `对象 ${name} 不存在`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(object),
                },
            ],
        };
    }
);

async function readMarkdownFile(filePath: string): Promise<string> {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        // 移除markdown注释 ([//]: # 开头的行)
        return content.split('\n')
            .filter((line: string) => !line.trim().startsWith('[//]: #'))
            .join('\n');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return '';
    }
}

async function getDocuments(docFiles: string[]): Promise<string> {
    const contents = await Promise.all(
        docFiles.map(file => readMarkdownFile(path.resolve(__dirname, './doc', file)))
    );

    return contents.join('\n\n');
}

const apiDocFiles = [
    'meta-data.md',
    'biz-data.md',
    'org-data.md',
    'device.md',
    'storage.md',
    'network.md',
    'user-interface.md'
];
const componentDocFiles = [
    'style.md',
    'Flex.md',
    'Text.md',
    'Button.md',
    'FilePicker.md',
    'Link.md',
    'Modal.md',
];
const formPluginDocFiles = [
    'form-page.md',
];
const detailPluginDocFiles = [
    'detail-page.md',
];

server.tool('form-page-API', '获取对象表单页插件文档，包含表单页的各种生命周期和事件回调', async () => {
    console.error('form-page-API');

    const cleanContent = await getDocuments(formPluginDocFiles.concat(apiDocFiles).concat(componentDocFiles));

    return {
        content: [
            {
                type: 'text',
                text: cleanContent,
            },
        ],
    };
});

server.tool('detail-page-API', '获取对象详情页插件文档，包含详情页的各种生命周期和事件回调', async () => {
    console.error('detail-page-API');

    const cleanContent = await getDocuments(detailPluginDocFiles.concat(apiDocFiles).concat(componentDocFiles));

    return {
        content: [
            {
                type: 'text',
                text: cleanContent,
            },
        ],
    };
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Hecom MCP Server running on stdio');
}

main().catch(error => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
