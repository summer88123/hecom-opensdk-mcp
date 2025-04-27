import { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import HecomClient from './HecomClient.js';

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
const hecom = new HecomClient({
    clientId: process.env.HECOM_CLIENT_ID || '',
    clientSecret: process.env.HECOM_CLIENT_SECRET || '',
    username: process.env.HECOM_USERNAME || '',
    apiHost: process.env.HECOM_HOST || '',
});

const getObjects = server.tool('get-objects', '获取可用的对象列表', async () => {
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
                        .map((obj) => ({
                            label: obj.label,
                            name: obj.name,
                            description: obj.description,
                        }))
                ),
            },
        ],
    };
});

const getObjectDesc = server.tool(
    'get-object-desc',
    '获取对象的描述，包括对象bizType列表和field列表，如果用户提到了具体的对象，始终应该先调用这个工具来获取对象的描述',
    { label: z.string().describe('').optional(), name: z.string().describe('对象name') },
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

const getDescToolList: RegisteredTool[] = []

const markObjects = server.tool(
    'mark-objects',
    '专注某些对象，当用户需要 **标记** **选择** 某些特定对象时使用，如果你不知道有哪些对象可以选择，可以先调用 get-objects 工具',
    {
        objects: z.array(
            z.object({
                label: z.string().describe('对象标签').optional(),
                name: z.string().describe('对象name')
            })
        )
    },
    async ({ objects }) => {
        const list = await hecom.markObjects(objects);

        if (!list || list.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `标记对象失败，未找到匹配的对象`,
                    },
                ],
            };
        }

        const objectNames = list.map(obj => obj.name).join(', ');

        // 隐藏getObjects和getObjectDesc工具
        getObjectDesc.disable();

        // 为每个标记的对象创建直接获取对象描述的工具
        for (const obj of list) {
            const tool = server.tool(
                `get-${obj.name}-desc`,
                `获取 ${obj.label}(${obj.name}) 对象的描述信息，包括对象bizType列表和field列表，如果用户提到了具体的对象，始终应该先调用这个工具来获取对象的描述`,
                async () => {
                    const object = await hecom.getObjectDescription(obj.name);

                    if (!object) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `对象 ${obj.name} 不存在`,
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
            getDescToolList.push(tool);
        }

        return {
            content: [
                {
                    type: 'text',
                    text: `标记对象 ${objectNames} 成功，已创建对应的对象描述工具`,
                },
            ],
        };
    }
);

const clearMarkObjects = server.tool(
    'clear-mark-objects',
    '清除标记的对象，清除所有标记的对象，恢复默认状态',
    async () => {   
        // 恢复默认状态，启用getObjectDesc工具
        getObjectDesc.enable();
        for (const tool of getDescToolList) {
            tool.remove(); // 移除工具
        }
        getDescToolList.length = 0; // 清空工具列表
        return {
            content: [
                {
                    type: 'text',
                    text: `清除标记对象成功`,
                },
            ],
        };
    }
);

const getObjectDataBySQL = server.tool(
    'get-object-data-by-sql',
    `使用 SQL 语句查询对象数据，如果你不了解对象的数据结构，可以先调用get-object-desc工具来获取对象的描述。
        SQL 仅支持基础的查询，不支持复杂的查询和联表查询，不支持函数例如SUM、YEAR等。
    `,
    { sql: z.string().describe('SQL 语句') },
    async ({ sql }) => {
        const data = await hecom.queryObjectDataWithSQL(sql);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data),
                },
            ],
        };
    }
)

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
