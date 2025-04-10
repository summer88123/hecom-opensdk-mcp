import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import HClient, { ObjectMeta } from 'hecom-openapi';

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

server.tool('get-objects', '获取可用的对象列表', {}, async () => {
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
                        .filter(o => o.label.length > 10)
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
    '获取对象的描述，包括对象bizType列表和field列表',
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
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Weather MCP Server running on stdio');
}

main().catch(error => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
